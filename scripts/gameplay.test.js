import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { LEVELS } from '../src/data/levels.js';
import { WORD_SET } from '../src/data/wordlist.js';
import { generateGuaranteedBoard } from '../src/utils/levelGenerator.js';
import { fillTargetLetterDeficits } from '../src/utils/targetLetters.js';
import { findWordMatchesSymbolic, trySwapSymbolic } from './symbolicBoard.mjs';
import { grantReward } from '../src/utils/adsStore.js';
import { claimToday } from '../src/utils/dailyRewardStore.js';

const storage = new Map();
beforeEach(() => {
  storage.clear();
  globalThis.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  };
});

function containsWord(grid, word) {
  const reversed = [...word].reverse().join('');
  const lines = [...grid, ...grid[0].map((_, col) => grid.map((row) => row[col]))];
  return lines.some((line) => line.join('').includes(word) || line.join('').includes(reversed));
}

test('every target level starts match-free and has a legal winning swap', () => {
  for (const level of LEVELS.filter((entry) => entry.type === 'target')) {
    assert.ok(WORD_SET.has(level.targetWord), level.targetWord);
    for (let trial = 0; trial < 12; trial++) {
      const { grid, solutionSwap } = generateGuaranteedBoard(level.targetWord);
      assert.equal(findWordMatchesSymbolic(grid).matchedCells.size, 0, level.targetWord);
      const [r1, c1, r2, c2] = solutionSwap;
      assert.equal(Math.abs(r1 - r2) + Math.abs(c1 - c2), 1);
      const swapped = grid.map((row) => [...row]);
      [swapped[r1][c1], swapped[r2][c2]] = [swapped[r2][c2], swapped[r1][c1]];
      assert.ok(containsWord(swapped, level.targetWord), level.targetWord);
      assert.ok(trySwapSymbolic(grid, ...solutionSwap), level.targetWord);
    }
  }
});

test('target inventory preserves repeated letters', () => {
  const letters = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
  const result = fillTargetLetterDeficits(letters, 'SHEEP');
  assert.equal(result.length, letters.length);
  assert.equal(result.filter((letter) => letter === 'E').length, 2);
  assert.equal(result.filter((letter) => letter === 'S').length, 1);
  assert.equal(result.filter((letter) => letter === 'H').length, 1);
  assert.equal(result.filter((letter) => letter === 'P').length, 1);
});

test('full-inventory ad fallback actually credits gems', () => {
  storage.set('wordswoop_boosters', JSON.stringify({ bomb: 2, shuffle: 3, lens: 3 }));
  assert.deepEqual(grantReward('bomb'), { type: 'gems', amount: 10, fullInventory: 'bomb' });
  assert.deepEqual(grantReward('shuffle'), { type: 'gems', amount: 10, fullInventory: 'shuffle' });
  assert.deepEqual(grantReward('life'), { type: 'gems', amount: 10, fullInventory: 'life' });
  assert.equal(JSON.parse(storage.get('wordswoop_currency')).gems, 30);
});

test('day-seven claim compensates when all boosters are full', () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const date = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
  storage.set('wordswoop_daily_reward', JSON.stringify({ streakDay: 6, lastClaimDate: date }));
  storage.set('wordswoop_boosters', JSON.stringify({ bomb: 2, shuffle: 3, lens: 3 }));
  assert.deepEqual(claimToday(), { day: 7, reward: { type: 'gems', amount: 5 } });
  assert.equal(JSON.parse(storage.get('wordswoop_currency')).gems, 5);
});
