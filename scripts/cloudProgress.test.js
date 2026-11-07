import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { getGems, addGems, setGemAccount, getGemSyncSnapshot, applyGemSync } from '../src/utils/currencyStore.js';
import { completeLevel, getCompletedLevelIds } from '../src/utils/progressStore.js';
import { reconcileProfile, syncProfile } from '../src/utils/cloudProgress.js';

let storage;
beforeEach(() => {
  storage = new Map();
  globalThis.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
});
const profile = (gems = 100) => ({ gems, completed_level_ids: [1, 2], settings: { musicOn: false }, created_at: 'created', updated_at: 'updated' });

function fakeCloud(initial, { conflict, lostResponse, inFlight } = {}) {
  let row = structuredClone(initial);
  let writes = 0;
  const client = { from(table) {
    assert.equal(table, 'wordswoop_profiles');
    let update;
    const filters = {};
    return {
      select() { return this; },
      update(value) { update = JSON.parse(JSON.stringify(value)); return this; },
      eq(key, value) { filters[key] = value; return this; },
      async single() { return { data: structuredClone(row), error: null }; },
      async maybeSingle() {
        assert.equal(filters.id, 'user-a');
        if (conflict && writes++ === 0) { row.gems += 20; row.completed_level_ids.push(7); row.updated_at += 'x'; return { data: null }; }
        if (filters.updated_at !== row.updated_at || filters.gems !== row.gems) return { data: null };
        assert.ok(Array.isArray(update.completed_level_ids), 'actual JSON upload must contain an array');
        row = { ...row, ...update, updated_at: row.updated_at + 'x' };
        inFlight?.();
        if (lostResponse) { lostResponse = false; throw new Error('Response lost after commit'); }
        return { data: { id: 'user-a' } };
      },
    };
  } };
  return { client, read: () => row };
}

test('fresh device restores cloud gems; new guest rewards merge and retries do not duplicate them', async () => {
  addGems(10); setGemAccount('user-a'); completeLevel(3);
  const cloud = fakeCloud(profile());
  await syncProfile(cloud.client, 'user-a');
  assert.equal(getGems(), 110);
  assert.deepEqual([...getCompletedLevelIds()], [3, 1, 2]);
  await syncProfile(cloud.client, 'user-a');
  assert.equal(getGems(), 110);
  addGems(-50);
  await syncProfile(cloud.client, 'user-a');
  assert.equal(cloud.read().gems, 60);
  // A brand new device has no local money to overwrite the cloud balance.
  storage.clear(); setGemAccount('user-a');
  await syncProfile(cloud.client, 'user-a');
  assert.equal(getGems(), 60);
});

test('legacy balances retain the higher balance without double counting previous uploads', async () => {
  storage.set('wordswoop_currency', JSON.stringify({ gems: 150 }));
  setGemAccount('user-a'); addGems(5);
  const cloud = fakeCloud(profile(100));
  await syncProfile(cloud.client, 'user-a');
  assert.equal(getGems(), 155);
  await syncProfile(cloud.client, 'user-a');
  assert.equal(getGems(), 155);
});

test('a lost response after a successful write is safe to retry', async () => {
  addGems(10); setGemAccount('user-a');
  const cloud = fakeCloud(profile(), { lostResponse: true });
  await assert.rejects(syncProfile(cloud.client, 'user-a'), /lost/);
  assert.equal(getGems(), 10);
  assert.equal(cloud.read().gems, 110);
  await syncProfile(cloud.client, 'user-a');
  assert.equal(getGems(), 110);
  assert.equal(cloud.read().gems, 110);
});

test('concurrent device changes are re-read and merged, not overwritten', async () => {
  addGems(10); setGemAccount('user-a'); completeLevel(3);
  const cloud = fakeCloud(profile(), { conflict: true });
  await syncProfile(cloud.client, 'user-a');
  assert.equal(cloud.read().gems, 130);
  assert.deepEqual(new Set(cloud.read().completed_level_ids), new Set([1, 2, 3, 7]));
});

test('rewards earned during a request remain pending and upload once', async () => {
  setGemAccount('user-a');
  let first = true;
  const cloud = fakeCloud(profile(), { inFlight: () => { if (first) { first = false; addGems(10); completeLevel(9); } } });
  await syncProfile(cloud.client, 'user-a');
  assert.equal(getGems(), 110);
  assert.equal(cloud.read().gems, 100);
  assert.ok(getCompletedLevelIds().has(9));
  await syncProfile(cloud.client, 'user-a');
  assert.equal(cloud.read().gems, 110);
});

test('account switching isolates wallets and transfers new guest gems only once', () => {
  addGems(30); setGemAccount('user-a');
  setGemAccount(null); assert.equal(getGems(), 0);
  addGems(5); setGemAccount('user-b'); assert.equal(getGems(), 5);
  setGemAccount('user-a'); assert.equal(getGems(), 30);
  setGemAccount(null); addGems(2); setGemAccount('user-a'); assert.equal(getGems(), 32);
  setGemAccount(null); setGemAccount('user-a'); assert.equal(getGems(), 32);
});

test('an old request cannot change the wallet after switching accounts', () => {
  addGems(10); setGemAccount('user-a'); const snapshot = getGemSyncSnapshot('user-a');
  setGemAccount('user-b'); applyGemSync(snapshot, 1000);
  assert.equal(getGems(), 0);
});

test('malformed old completion JSON is repaired and receipts preserve preferences', () => {
  setGemAccount('user-a');
  const update = reconcileProfile({ ...profile(), completed_level_ids: {} }, getGemSyncSnapshot('user-a'), new Set([1, 2]), { musicOn: true });
  assert.deepEqual(update.completed_level_ids, [1, 2]);
  assert.equal(update.settings.musicOn, true);
  assert.ok(update.settings._gemReceipts);
});
