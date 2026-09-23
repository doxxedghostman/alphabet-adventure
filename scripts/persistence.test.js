import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test, beforeEach } from 'node:test';
import * as progress from '../src/utils/progressStore.js';
import * as sessions from '../src/utils/sessionStore.js';

const storage = new Map();
const localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
};
beforeEach(() => { storage.clear(); globalThis.localStorage = localStorage; });

const letters = Array.from({ length: 5 }, (_, r) => Array.from({ length: 5 }, (_, c) => 'ABCDE'[(r + c) % 5]));
const attempt = () => ({ levelId: 4, worldId: 1, levelNum: 4, grid: letters, movesLeft: 7, score: 420 });

test('world counts respect boundaries, duplicates, completion and disabled locks', () => {
  progress.setCompletedLevelIds([1, 1, 20, 21, 40]);
  assert.equal(progress.completedCountForWorld(1), 2);
  assert.equal(progress.completedCountForWorld(2), 2);
  assert.equal(progress.completedCountForWorld(1, 3), 1);
  assert.equal(progress.isWorldComplete(1), false);
  progress.setCompletedLevelIds(Array.from({ length: progress.LEVELS_PER_WORLD }, (_, i) => i + 21));
  assert.equal(progress.isWorldComplete(2), true);
  assert.equal(progress.isWorldUnlocked(10), true);
  assert.equal(progress.isLevelUnlocked(10, 20), true);
});

test('last played defaults to null and survives completion and cloud merge', () => {
  storage.set('wordswoop_progress', JSON.stringify({ completedLevelIds: [1] }));
  assert.equal(progress.getLastPlayed(), null);
  progress.setLastPlayed(2, 4);
  progress.completeLevel(24);
  progress.setCompletedLevelIds([1, 24, 25]);
  assert.deepEqual(progress.getLastPlayed(), { worldId: 2, levelNum: 4 });
  assert.deepEqual([...progress.getCompletedLevelIds()], [1, 24, 25]);
});

test('sessions round trip letters and only the six session fields', () => {
  sessions.saveSession({ ...attempt(), boosters: { bomb: 99 } });
  assert.deepEqual(sessions.getSession(), attempt());
  sessions.clearSession();
  assert.equal(sessions.getSession(), null);
});

test('missing, malformed and inaccessible storage fail safely', () => {
  const warn = console.warn;
  console.warn = () => {};
  try {
    for (const raw of [null, 'bad json', 'null', '{}', JSON.stringify({ ...attempt(), grid: [[{}]] }), JSON.stringify({ ...attempt(), movesLeft: -1 })]) {
      storage.set('wordswoop_session', raw);
      assert.equal(sessions.getSession(), null);
    }
    globalThis.localStorage = {
      getItem() { throw Error('blocked'); }, setItem() { throw Error('quota'); }, removeItem() { throw Error('blocked'); },
    };
    assert.equal(sessions.getSession(), null);
    assert.doesNotThrow(() => sessions.saveSession(attempt()));
    assert.doesNotThrow(() => sessions.clearSession());
    assert.equal(progress.getLastPlayed(), null);
  } finally { console.warn = warn; }
});

// Exercise the real scene lifecycle with rendering/animation dependencies stubbed.
function board() {
  const source = readFileSync(new URL('../src/scenes/BoardScene.js', import.meta.url), 'utf8')
    .replace(/^import[\s\S]*?from ['"][^'"]+['"];\r?\n/gm, '')
    .replace('export class BoardScene', 'class BoardScene');
  const Scene = runInNewContext(`${source}\nBoardScene`, {
    Phaser: { Scene: class {} }, BOARD_SIZE: 5, ...progress, ...sessions,
    bindHardwareBack() {}, getLivesStatus: () => ({ lives: 5 }),
    getLevel: (id) => ({ id, maxSwaps: 15, type: 'free', scoreTarget: 10000 }),
    getNextLevelId: () => 5, addGems() {}, syncLocalProgressToCloud() {}, loseLife() {},
  });
  const scene = new Scene();
  for (const name of ['computeBoardGeometry', 'createBoardBackdrop', 'createBoardFrame', 'setupInput', 'deselectTile', 'showEndPopup']) scene[name] = () => {};
  scene.createHud = () => { scene.hudState = { score: scene.score, moves: scene.movesLeft }; scene.hud = { setMoves() {} }; };
  scene.createTile = (row, col, letter) => ({ row, col, letter });
  scene.pickNonMatchingLetter = () => 'Z';
  scene.ensureSolvable = () => { scene.solvabilityChecks = (scene.solvabilityChecks ?? 0) + 1; };
  scene.scene = { start() {}, restart(data) { scene.restarted = data; } };
  return scene;
}

test('reopening the saved level restores exact cells, moves and score before HUD creation', () => {
  sessions.saveSession(attempt());
  const scene = board();
  scene.create({ levelId: 4, worldId: 1, levelNum: 4 });
  assert.deepEqual(scene.grid.map(row => row.map(tile => tile.letter)), letters);
  assert.deepEqual(scene.hudState, { score: 420, moves: 7 });
  assert.equal(scene.solvabilityChecks, undefined);
  scene.goBack();
  assert.deepEqual(sessions.getSession(), attempt());
});

test('another level and legacy entry start fresh and preserve the stale session', () => {
  sessions.saveSession(attempt());
  const scene = board();
  scene.create({ levelId: 5, worldId: 1, levelNum: 5 });
  assert.equal(scene.grid[0][0].letter, 'Z');
  assert.deepEqual(scene.hudState, { score: 0, moves: 15 });
  assert.deepEqual(sessions.getSession(), attempt());
  sessions.clearSession();
  assert.doesNotThrow(() => scene.create());
});

test('win, loss and explicit restart each discard the attempt', () => {
  for (const action of ['onLevelWon', 'onLevelLost', 'restartLevel']) {
    sessions.saveSession(attempt());
    const scene = board();
    scene.create({ levelId: 4, worldId: 1, levelNum: 4 });
    scene[action]();
    assert.equal(sessions.getSession(), null, action);
  }
});

test('settled moves save the resulting grid, score and moves', async () => {
  const scene = board();
  scene.create({ levelId: 4, worldId: 1, levelNum: 4 });
  for (const name of ['animateSwap', 'updateScoreText', 'showWordToast', 'clearTiles', 'collapseAndRefill', 'resolveAutoMatches']) scene[name] = async () => {};
  scene.findWordMatches = () => ({ matchedCells: new Set(['0,0']), wordsFound: ['CAT'] });
  await scene.attemptSwap({}, {});
  const saved = sessions.getSession();
  assert.equal(saved.movesLeft, 14);
  assert.equal(saved.score, 60);
  assert.deepEqual(saved.grid, Array.from(scene.grid, row => Array.from(row, tile => tile.letter)));
});

test('world tiles show progress only when unlocked and completion replaces continue treatment', () => {
  const source = readFileSync(new URL('../src/scenes/WorldSelectScene.js', import.meta.url), 'utf8')
    .replace(/^import[\s\S]*?from ['"][^'"]+['"];\r?\n/gm, '')
    .replace('export class WorldSelectScene', 'class WorldSelectScene');
  for (const state of ['locked', 'untouched', 'continuing', 'complete']) {
    const labels = [];
    const circles = [];
    const object = new Proxy({}, { get: () => () => object });
    const Scene = runInNewContext(`${source}\nWorldSelectScene`, {
      Phaser: { Scene: class {} }, LEVELS_PER_WORLD: progress.LEVELS_PER_WORLD,
      isWorldUnlocked: () => state !== 'locked',
      completedCountForWorld: () => state === 'complete' ? progress.LEVELS_PER_WORLD : 0,
      isWorldComplete: () => state === 'complete',
      getLastPlayed: () => state === 'untouched' ? null : { worldId: 1, levelNum: 4 },
    });
    const scene = new Scene();
    Object.assign(scene, { tileWidth: 200, tileHeight: 150, nameplateHeight: 42, gemRadius: 9 });
    scene.drawWorldName = scene.drawLockIcon = () => {};
    scene.add = {
      image: () => object, graphics: () => object, rectangle: () => object,
      text: (x, y, label) => { labels.push(label); return object; },
      circle: (...args) => { circles.push(args); return object; },
    };
    scene.drawTile({ id: 1, name: 'Candy', thumbKey: 'candy', gemColor: 0 }, 16, 80);
    assert.equal(labels.some(label => label.includes('/')), state !== 'locked', state);
    assert.equal(labels.includes('CONTINUE HERE'), state === 'continuing', state);
    assert.equal(circles.length, state === 'complete' ? 1 : 0, state);
  }
});
