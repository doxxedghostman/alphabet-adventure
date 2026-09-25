// Booster inventory for Bomb, Shuffle, and Lens.
// PLAN.md §14 as planned meta-systems but were never actually built.
// Lens now follows the same inventory pattern. Starting supply matches
// the hold caps below; existing stored values are preserved, while a
// newly introduced booster begins at its default cap.
//
// Same single-JSON-blob-in-localStorage pattern as the other stores.

const STORAGE_KEY = 'wordswoop_boosters';

export const BOOSTER_TYPES = ['bomb', 'shuffle', 'lens'];

// Max held at once: 2 Bomb, 3 Shuffle, 3 Lens. A reward that would
// push past this (Calendar Day 7, Watch to Earn) is simply not
// granted rather than banked past the cap - see addBooster() below.
export const MAX_BOOSTERS = { bomb: 2, shuffle: 3, lens: 3 };
const DEFAULTS = {
  bomb: MAX_BOOSTERS.bomb,
  shuffle: MAX_BOOSTERS.shuffle,
  lens: MAX_BOOSTERS.lens,
};

function loadRaw() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return {
      bomb: typeof parsed.bomb === 'number' ? parsed.bomb : DEFAULTS.bomb,
      shuffle: typeof parsed.shuffle === 'number' ? parsed.shuffle : DEFAULTS.shuffle,
      lens: typeof parsed.lens === 'number' ? parsed.lens : DEFAULTS.lens,
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

/** Grants +1 of the given booster type ('bomb' | 'shuffle' | 'lens'), unless
 * already at MAX_BOOSTERS for that type - in which case nothing
 * changes. Returns { value, granted } so callers (adsStore.js,
 * dailyRewardStore.js) can tell whether the reward actually landed or
 * was wasted at a full inventory, and message the player honestly
 * either way instead of always saying "You won a Bomb!". */
export function addBooster(type) {
  const data = loadRaw();
  if (!(type in data)) return { value: data[type], granted: false };
  if (data[type] >= MAX_BOOSTERS[type]) return { value: data[type], granted: false };
  data[type] += 1;
  saveRaw(data);
  return { value: data[type], granted: true };
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
