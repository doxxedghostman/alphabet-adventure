// Currency store — gems. Per chat: HomeHubScene has been showing a
// hardcoded "0" since it was built (PLAN.md: "currency/economy is
// display-only, no real economy system yet"). This is the first real
// balance, added specifically so dailyRewardStore.js has somewhere to
// actually deposit its gem payouts — Shop/spending still don't exist,
// so this only grows for now.
//
// Same single-JSON-blob-in-localStorage pattern as progressStore.js /
// settingsStore.js, kept as its own key/file since gems are neither
// level progress nor a preference.
//
// NOTE: this is local-only, same as progressStore.js — it does not
// sync to `wordswoop_profiles.gems` in Supabase for signed-in users.
// That table already has a `gems` column (see update.md Milestone 25)
// but nothing client-side reads/writes it yet; wiring real cloud sync
// for currency (with the same guest-merge care progressStore's
// completedLevelIds gets) is separate follow-up work, not bundled in
// here.

const STORAGE_KEY = 'wordswoop_currency';

function loadRaw() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { gems: 0 };
    const parsed = JSON.parse(raw);
    if (typeof parsed.gems !== 'number' || Number.isNaN(parsed.gems)) return { gems: 0 };
    return parsed;
  } catch (err) {
    console.warn('currencyStore: failed to read localStorage, starting fresh', err);
    return { gems: 0 };
  }
}

function saveRaw(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('currencyStore: failed to write localStorage', err);
  }
}

export function getGems() {
  return loadRaw().gems;
}

/** Adds (or, with a negative amount, removes) gems. Never goes below 0. */
export function addGems(amount) {
  const data = loadRaw();
  data.gems = Math.max(0, data.gems + amount);
  saveRaw(data);
  return data.gems;
}
