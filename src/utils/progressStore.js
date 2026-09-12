// Progress store (PLAN.md §8.5) — the game's first persistence of any
// kind. Nothing survived a page reload before this; every session
// started back at Level 1. Backed by localStorage, single JSON blob.
//
// Design: rather than store "unlocked" state directly, we store only
// WHAT'S BEEN COMPLETED (a set of global level ids) and DERIVE lock
// state from it every time it's asked for. This avoids the two ever
// getting out of sync — there's only one source of truth to update
// when a level is won.
//
// Global level ids vs. per-world level numbers: levels.js numbers
// levels globally (1, 2, 3, ...) with no notion of "world". The World
// Map needs per-world level numbers 1-20 instead. LEVELS_PER_WORLD
// fixes the mapping in one place: world 1 = global ids 1-20, world 2 =
// 21-40, etc. (see worlds.js, which uses the same helpers).
//
// Lock rules (decided, see PLAN.md §8.5):
//   - World 1 is always unlocked.
//   - World N (N>1) unlocks once World N-1's level 20 (its boss) is
//     complete.
//   - Level 1 of an unlocked world is always unlocked.
//   - Level K (K>1) unlocks once level K-1 in the same world is
//     complete.
//
// NOTE: only 5 real levels exist in levels.js right now (levels.js's
// own TODO — authoring the full 200-level list is separate work), so
// most level nodes past Candy Garden's first few will currently load
// via getLevel()'s fallback (defaults to level 1) rather than unique
// content. That's a content gap, not a bug in this store — the
// lock/unlock chain itself works correctly regardless of how much
// real content sits behind each id.

const STORAGE_KEY = 'wordswoop_progress';
export const LEVELS_PER_WORLD = 20;

function loadRaw() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { completedLevelIds: [] };
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.completedLevelIds)) return { completedLevelIds: [] };
    return parsed;
  } catch (err) {
    // Corrupt or inaccessible storage (private browsing, quota, bad JSON)
    // - fail safe to "nothing completed" rather than throwing, since a
    // progress-read should never be able to crash the game.
    console.warn('progressStore: failed to read localStorage, starting fresh', err);
    return { completedLevelIds: [] };
  }
}

function saveRaw(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('progressStore: failed to write localStorage', err);
  }
}

/** Global level id for a given world + 1-based level number within it. */
export function levelIdFor(worldId, levelNum) {
  return (worldId - 1) * LEVELS_PER_WORLD + levelNum;
}

/** Returns { worldId, levelNum } for a global level id. */
export function worldAndLevelFor(levelId) {
  const worldId = Math.floor((levelId - 1) / LEVELS_PER_WORLD) + 1;
  const levelNum = ((levelId - 1) % LEVELS_PER_WORLD) + 1;
  return { worldId, levelNum };
}

export function getCompletedLevelIds() {
  return new Set(loadRaw().completedLevelIds);
}

export function isLevelComplete(levelId) {
  return getCompletedLevelIds().has(levelId);
}

export function completeLevel(levelId) {
  const data = loadRaw();
  if (!data.completedLevelIds.includes(levelId)) {
    data.completedLevelIds.push(levelId);
    saveRaw(data);
  }
}

export function isWorldUnlocked(worldId) {
  if (worldId <= 1) return true;
  const previousBossId = levelIdFor(worldId - 1, LEVELS_PER_WORLD);
  return isLevelComplete(previousBossId);
}

export function isLevelUnlocked(worldId, levelNum) {
  if (!isWorldUnlocked(worldId)) return false;
  if (levelNum <= 1) return true;
  return isLevelComplete(levelIdFor(worldId, levelNum - 1));
}

// Convenience for the "resume where you left off" case: the highest
// level number in a world that's unlocked but not yet completed. Falls
// back to 1 if the world is locked or nothing's been played yet.
export function nextPlayableLevelNum(worldId) {
  if (!isWorldUnlocked(worldId)) return 1;
  for (let n = 1; n <= LEVELS_PER_WORLD; n += 1) {
    if (!isLevelComplete(levelIdFor(worldId, n))) return n;
  }
  return LEVELS_PER_WORLD; // whole world already completed
}

export function resetProgress() {
  localStorage.removeItem(STORAGE_KEY);
}

/** Bulk-replace the completed set — used by authStore's guest->cloud
 * merge on first sign-in (union of local + cloud, written back here so
 * local and cloud agree after a sync), not by normal gameplay (which
 * should keep using completeLevel() one at a time). */
export function setCompletedLevelIds(ids) {
  saveRaw({ completedLevelIds: [...new Set(ids)] });
}

/** Count of worlds currently unlocked, out of WORLDS.length -- used for the
 * home screen's "Worlds Unlocked" badge. Takes worldCount as a param
 * rather than importing worlds.js, to avoid a circular import (worlds.js
 * already imports from this file). */
export function unlockedWorldCount(worldCount) {
  let count = 0;
  for (let w = 1; w <= worldCount; w += 1) {
    if (isWorldUnlocked(w)) count += 1;
  }
  return count;
}

// Escape hatch for testing/debugging from the browser console:
// window.__wordswoopResetProgress()
if (typeof window !== 'undefined') {
  window.__wordswoopResetProgress = () => {
    resetProgress();
    console.log('WordSwoop progress reset.');
  };
}
