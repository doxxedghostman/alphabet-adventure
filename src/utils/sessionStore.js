// One local-only, unfinished attempt. Booster inventory stays in boosterStore.
const STORAGE_KEY = 'wordswoop_session';

function validSession(value) {
  return Number.isInteger(value?.levelId) && value.levelId > 0
    && Number.isInteger(value.worldId) && value.worldId > 0
    && Number.isInteger(value.levelNum) && value.levelNum > 0
    && Number.isInteger(value.movesLeft) && value.movesLeft > 0
    && Number.isFinite(value.score) && value.score >= 0
    && Array.isArray(value.grid) && value.grid.length > 0
    && value.grid.every((row) => Array.isArray(row) && row.length === value.grid.length
      && row.every((letter) => typeof letter === 'string' && /^[A-Z]$/.test(letter)));
}

export function saveSession({ levelId, worldId, levelNum, grid, movesLeft, score }) {
  try {
    // Explicit fields prevent unrelated state (especially boosters) being saved.
    const session = { levelId, worldId, levelNum, grid, movesLeft, score };
    if (!validSession(session)) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch (err) {
    console.warn('sessionStore: failed to write localStorage', err);
  }
}

export function getSession() {
  try {
    const session = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return validSession(session) ? session : null;
  } catch (err) {
    console.warn('sessionStore: failed to read localStorage', err);
    return null;
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('sessionStore: failed to clear localStorage', err);
  }
}
