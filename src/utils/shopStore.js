// Per-offer limits reset on the player's local calendar day.
const STORAGE_KEY = 'wordswoop_shop';
export const OFFER_CAPS = Object.freeze({
  gems: 1,
  bomb: 3,
  shuffle: 3,
  lens: 3,
  bundle: 5,
});
const OFFER_KEYS = Object.keys(OFFER_CAPS);

function dateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function todayStr() {
  return dateStr(new Date());
}

function loadRaw() {
  const fresh = { date: todayStr(), watches: {} };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fresh;
    const parsed = JSON.parse(raw);
    if (parsed?.date !== fresh.date) return fresh;
    for (const key of OFFER_KEYS) {
      const count = parsed.watches?.[key];
      fresh.watches[key] = Number.isSafeInteger(count) && count >= 0 ? count : 0;
    }
    return fresh;
  } catch (err) {
    console.warn('shopStore: failed to read localStorage, starting fresh', err);
    return fresh;
  }
}

function saveRaw(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('shopStore: failed to write localStorage', err);
  }
}

export function getWatchesToday(offerKey) {
  if (!OFFER_KEYS.includes(offerKey)) return 0;
  return Math.min(loadRaw().watches[offerKey] ?? 0, OFFER_CAPS[offerKey]);
}

export function recordWatch(offerKey) {
  if (!OFFER_KEYS.includes(offerKey)) return;
  const data = loadRaw();
  data.watches[offerKey] = Math.min((data.watches[offerKey] ?? 0) + 1, OFFER_CAPS[offerKey]);
  saveRaw(data);
}

export function watchesRemaining(offerKey) {
  if (!OFFER_KEYS.includes(offerKey)) return 0;
  return Math.max(0, OFFER_CAPS[offerKey] - getWatchesToday(offerKey));
}
