// Settings store — user preferences that aren't game progress (see
// progressStore.js for that). Same single-JSON-blob-in-localStorage
// pattern, kept as a separate key/file since these are conceptually
// different things (a "reset progress" action should never touch a
// person's audio preference, and vice versa).
//
// NOTE: musicOn/sfxOn/hapticsOn are wired up to the Settings screen
// toggle rows, but nothing in the game actually reads them yet — there
// is no audio system (no this.sound usage anywhere) and no
// @capacitor/haptics dependency installed. The toggles persist a
// preference now so the UI is real and the value survives a reload;
// whatever adds music/SFX/haptics later just needs to check these
// getters before playing anything.

const STORAGE_KEY = 'wordswoop_settings';

const DEFAULTS = {
  musicOn: true,
  sfxOn: true,
  hapticsOn: true,
};

function loadRaw() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed };
  } catch (err) {
    console.warn('settingsStore: failed to read localStorage, using defaults', err);
    return { ...DEFAULTS };
  }
}

function saveRaw(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('settingsStore: failed to write localStorage', err);
  }
}

export function getSettings() {
  return loadRaw();
}

export function isMusicOn() {
  return loadRaw().musicOn;
}

export function isSfxOn() {
  return loadRaw().sfxOn;
}

export function isHapticsOn() {
  return loadRaw().hapticsOn;
}

export function setMusicOn(value) {
  const data = loadRaw();
  data.musicOn = value;
  saveRaw(data);
}

export function setSfxOn(value) {
  const data = loadRaw();
  data.sfxOn = value;
  saveRaw(data);
}

export function setHapticsOn(value) {
  const data = loadRaw();
  data.hapticsOn = value;
  saveRaw(data);
}
