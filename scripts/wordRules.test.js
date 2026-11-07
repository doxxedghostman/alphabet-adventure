import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { EventEmitter } from 'node:events';
import * as config from '../src/config.js';
import * as rules from '../src/utils/wordRules.js';
import { WORD_SET } from '../src/data/wordlist.js';
import { generateGuaranteedBoard } from '../src/utils/levelGenerator.js';
import { getSession } from '../src/utils/sessionStore.js';
import { fillTargetLetterDeficits } from '../src/utils/targetLetters.js';
import { findWordMatchesSymbolic } from './symbolicBoard.mjs';

function board(lines = ['QQQQQ', 'QQQQQ', 'QQQQQ', 'QQQQQ', 'QQQQQ']) {
  const source = readFileSync(new URL('../src/scenes/BoardScene.js', import.meta.url), 'utf8')
    .replace(/^import[\s\S]*?from ['"][^'"]+['"];\r?\n/gm, '').replace('export class BoardScene', 'class BoardScene');
  const Scene = runInNewContext(`${source}\nBoardScene`, {
    Phaser: { Scene: class {}, Math: { Between: (a) => a }, Utils: { Array: { GetRandom: (items) => items[0] } } },
    ...config, ...rules, WORD_SET, generateGuaranteedBoard, fillTargetLetterDeficits,
    playShuffle() {}, playBomb() {}, hapticMedium() {}, hapticError() {},
    saveSession: (data) => localStorage.setItem('wordswoop_session', JSON.stringify(data)),
  });
  const scene = new Scene();
  scene.events = new EventEmitter();
  scene.createTile = (row, col, letter) => ({ row, col, letter, container: {}, text: { text: letter, setText(value) { this.text = value; } } });
  scene.grid = lines.map((line, row) => [...line].map((letter, col) => scene.createTile(row, col, letter)));
  scene.deselectTile = scene.setTileColor = scene.spawnCandyPop = () => {};
  scene.tweens = { add: (config) => config.onComplete?.() };
  scene.level = { id: 4, type: 'free' }; scene.worldId = 1; scene.levelNum = 4; scene.score = 50; scene.movesLeft = 10;
  return scene;
}

test('GOAT scores horizontally and vertically; TAOG never counts as GOAT', () => {
  for (const vertical of [false, true]) {
    for (const word of ['GOAT', 'TAOG']) {
      const lines = ['QQQQQ', 'QQQQQ', 'QQQQQ', 'QQQQQ', 'QQQQQ'].map((line) => [...line]);
      [...word].forEach((letter, i) => { lines[vertical ? i : 0][vertical ? 0 : i] = letter; });
      const scene = board(lines.map((line) => line.join(''))); scene.targetWord = 'GOAT';
      assert.equal(scene.findWordMatches().wordsFound.includes('GOAT'), word === 'GOAT');
      assert.equal(scene.boardContainsTargetWord(), word === 'GOAT');
      assert.equal(findWordMatchesSymbolic(lines).wordsFound.includes('GOAT'), word === 'GOAT');
    }
  }
});

test('legal-swap detection and hints use forward words only', () => {
  const forward = board(['GQATQ', 'QOQQQ', 'QQQQQ', 'QQQQQ', 'QQQQQ']);
  assert.equal(forward.wouldSwapCreateWord(0, 1, 1, 1), true);
  assert.ok(forward.findLensHintSwap());
  const reverse = board(['TQOGQ', 'QAQQQ', 'QQQQQ', 'QQQQQ', 'QQQQQ']);
  assert.equal(reverse.wouldSwapCreateWord(0, 1, 1, 1), false);
});

test('unknown simulator cells break a word', () => {
  assert.equal(rules.lineHasWord(['G', 'O', null, 'A', 'T']), false);
});

test('1000 initial free-play deals contain no completed words', () => {
  for (let trial = 0; trial < 1000; trial++) {
    const scene = board(); scene.grid = []; scene.createInitialBoard();
    assert.equal(scene.findWordMatches().matchedCells.size, 0);
  }
});

test('shuffle refreshes visible letters, preserves onComplete and saves the new attempt', async () => {
  const storage = new Map(); globalThis.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  const scene = board(['GQATQ', 'QOQQQ', 'QQQQQ', 'QQQQQ', 'QQQQQ']);
  const before = scene.grid.flat().map((tile) => tile.letter).join('');
  scene.shuffleArray = (items) => items.reverse();
  scene.resolveAutoMatches = scene.ensureSolvable = async () => {};
  await scene.shuffleBoard();
  assert.notEqual(scene.grid.flat().map((tile) => tile.letter).join(''), before);
  for (const tile of scene.grid.flat()) assert.equal(tile.text.text, tile.letter);
  assert.deepEqual(getSession().grid, JSON.parse(JSON.stringify(scene.grid.map((row) => row.map((tile) => tile.letter)))));
});

test('Bomb saves its settled board without restoring spent inventory', async () => {
  const storage = new Map(); globalThis.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  const scene = board(['GQATQ', 'QOQQQ', 'QQQQQ', 'QQQQQ', 'QQQQQ']);
  scene.clearTiles = async () => {};
  scene.collapseAndRefill = async () => { scene.grid[0][0].letter = 'Z'; };
  scene.resolveAutoMatches = scene.ensureSolvable = async () => {};
  await scene.triggerBombClear();
  assert.equal(getSession().grid[0][0], 'Z');
  assert.equal(getSession().movesLeft, 10);
});

test('an open booster prompt blocks tile input and additional booster actions', () => {
  const scene = board(); scene.boosterPromptOpen = true;
  scene.handlePointerDown({ x: 0, y: 0 });
  scene.onShufflePressed(); scene.onLensPressed();
  assert.equal(scene.selectedTile, undefined);
});
