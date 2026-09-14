// Lives — per PLAN.md §14: start at 5 (max 5), lose 1 on a failed
// level, regenerate automatically (+1 every 30 min), refillable via a
// rewarded ad (adsStore.js's reward pool - see its header comment).
// Classic Candy-Crush-style return loop; this is the first time it
// actually exists as a real, enforced limit rather than just a plan.
//
// Same single-JSON-blob-in-localStorage pattern as the other stores.
// Regeneration is computed lazily on read (elapsed-time math), not via
// a running timer, so it's correct even if the app was closed the
// whole time - same approach as any offline-friendly regen system.

const STORAGE_KEY = 'wordswoop_lives';
export const MAX_LIVES = 5;
const REGEN_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

function loadRaw() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { lives: MAX_LIVES, regenStartedAt: null };
    const parsed = JSON.parse(raw);
    return {
      lives: typeof parsed.lives === 'number' ? parsed.lives : MAX_LIVES,
      regenStartedAt: typeof parsed.regenStartedAt === 'number' ? parsed.regenStartedAt : null,
    };
  } catch (err) {
    console.warn('livesStore: failed to read localStorage, starting fresh', err);
    return { lives: MAX_LIVES, regenStartedAt: null };
  }
}

function saveRaw(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('livesStore: failed to write localStorage', err);
  }
}

/** Applies any regen owed since regenStartedAt, persists the result,
 * and returns the up-to-date { lives, msUntilNextLife } (0 when full). */
function resolveRegen() {
  const data = loadRaw();

  if (data.lives >= MAX_LIVES || data.regenStartedAt === null) {
    return { lives: data.lives, msUntilNextLife: 0 };
  }

  const elapsed = Date.now() - data.regenStartedAt;
  const gained = Math.floor(elapsed / REGEN_INTERVAL_MS);

  if (gained > 0) {
    data.lives = Math.min(MAX_LIVES, data.lives + gained);
    data.regenStartedAt = data.lives >= MAX_LIVES ? null : data.regenStartedAt + gained * REGEN_INTERVAL_MS;
    saveRaw(data);
  }

  const msUntilNextLife = data.lives >= MAX_LIVES ? 0 : REGEN_INTERVAL_MS - ((Date.now() - data.regenStartedAt) % REGEN_INTERVAL_MS);
  return { lives: data.lives, msUntilNextLife };
}

export function getLivesStatus() {
  return resolveRegen();
}

/** Deducts 1 life (never below 0). Starts the regen clock if this is
 * the first life lost since being full. */
export function loseLife() {
  resolveRegen();
  const data = loadRaw();
  if (data.lives <= 0) return data.lives;

  const wasFull = data.lives >= MAX_LIVES;
  data.lives -= 1;
  if (wasFull) data.regenStartedAt = Date.now();
  saveRaw(data);
  return data.lives;
}

/** Grants lives (e.g. from a rewarded ad), capped at MAX_LIVES. */
export function addLives(amount) {
  resolveRegen();
  const data = loadRaw();
  data.lives = Math.min(MAX_LIVES, data.lives + amount);
  if (data.lives >= MAX_LIVES) data.regenStartedAt = null;
  saveRaw(data);
  return data.lives;
}
