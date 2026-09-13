// Booster inventory — per chat, Bomb and Shuffle are documented in
// PLAN.md §14 as planned meta-systems but were never actually built:
// there was no way to hold or spend one. This is the deliberately
// minimal first piece — just a count per booster type in localStorage
// — added so dailyRewardStore.js's Day 7 reward has something real to
// grant. It does NOT make boosters usable on the board yet; that's a
// separate, bigger follow-up (BoardScene needs a way to spend one and
// apply its effect). Until then, a granted booster just sits in this
// count, visible wherever something chooses to display it.
//
// Same single-JSON-blob-in-localStorage pattern as the other stores.

const STORAGE_KEY = 'wordswoop_boosters';

export const BOOSTER_TYPES = ['bomb', 'shuffle'];

function loadRaw() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { bomb: 0, shuffle: 0 };
    const parsed = JSON.parse(raw);
    return {
      bomb: typeof parsed.bomb === 'number' ? parsed.bomb : 0,
      shuffle: typeof parsed.shuffle === 'number' ? parsed.shuffle : 0,
    };
  } catch (err) {
    console.warn('boosterStore: failed to read localStorage, starting fresh', err);
    return { bomb: 0, shuffle: 0 };
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

/** Picks one booster type at random — used for the Day 7 surprise reward. */
export function randomBoosterType() {
  return BOOSTER_TYPES[Math.floor(Math.random() * BOOSTER_TYPES.length)];
}
