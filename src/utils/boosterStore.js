// Booster inventory — per chat, Bomb and Shuffle are documented in
// PLAN.md §14 as planned meta-systems but were never actually built:
// there was no way to hold or spend one. Starting supply (bomb: 2,
// shuffle: 5) matches §14's suggested numbers, applied here now that
// both are actually spendable (BoardScene) instead of just a count
// Calendar could grant. Existing players who already have a stored
// count (even 0, from a prior Calendar claim) keep it - these
// defaults only apply to a install that's never touched this store.
//
// Same single-JSON-blob-in-localStorage pattern as the other stores.

const STORAGE_KEY = 'wordswoop_boosters';

export const BOOSTER_TYPES = ['bomb', 'shuffle'];
const DEFAULTS = { bomb: 2, shuffle: 5 };

function loadRaw() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return {
      bomb: typeof parsed.bomb === 'number' ? parsed.bomb : DEFAULTS.bomb,
      shuffle: typeof parsed.shuffle === 'number' ? parsed.shuffle : DEFAULTS.shuffle,
    };
  } catch (err) {
    console.warn('boosterStore: failed to read localStorage, starting fresh', err);
    return { ...DEFAULTS };
  }
}

function saveRaw(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('boosterStore: failed to write localStorage', err);
  }
}

export function getBoosters() {
  return loadRaw();
}

/** Grants +1 of the given booster type ('bomb' | 'shuffle'). */
export function addBooster(type) {
  const data = loadRaw();
  if (!(type in data)) return data;
  data[type] += 1;
  saveRaw(data);
  return data;
}

/** Spends 1 of the given booster type. Returns true if one was
 * available and spent, false if the count was already 0. */
export function spendBooster(type) {
  const data = loadRaw();
  if (!(type in data) || data[type] <= 0) return false;
  data[type] -= 1;
  saveRaw(data);
  return true;
}

/** Picks one booster type at random — used for the Day 7 surprise reward. */
export function randomBoosterType() {
  return BOOSTER_TYPES[Math.floor(Math.random() * BOOSTER_TYPES.length)];
}
