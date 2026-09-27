import { isMusicOn } from './settingsStore.js';
import { ensureContext } from './sfx.js';

const TRACKS = [
  'assets/music/meadows-first-light.mp3',
  'assets/music/bouncing-marimba.mp3',
  'assets/music/map-of-wonders.mp3',
  'assets/music/map-of-wonders-alt.mp3',
  'assets/music/bouncy-match-3-groove.mp3',
  'assets/music/three-tiles-left.mp3',
];

const FADE_SECONDS = 0.4;
const MUSIC_VOLUME = 0.35;

const bufferCache = new Map(); // url -> AudioBuffer | Promise<AudioBuffer> | null (failed)

let activeGroup = null;
let currentUrl = null;
let currentSource = null;
let musicGain = null;
let musicEnabled = isMusicOn();
let transitionId = 0;

export function loadTrack(url) {
  if (bufferCache.has(url)) return bufferCache.get(url);

  const ctx = ensureContext();
  if (!ctx) return Promise.resolve(null);

  const promise = fetch(url)
    .then((res) => res.arrayBuffer())
    .then((data) => ctx.decodeAudioData(data))
    .then((buffer) => {
      bufferCache.set(url, buffer);
      return buffer;
    })
    .catch((err) => {
      console.warn(`music: failed to load ${url}`, err);
      bufferCache.set(url, null);
      return null;
    });

  bufferCache.set(url, promise);
  return promise;
}

export function pickRandomTrack(excludeUrl) {
  let track = TRACKS[Math.floor(Math.random() * TRACKS.length)];
  if (TRACKS.length > 1 && track === excludeUrl) {
    track = TRACKS[Math.floor(Math.random() * TRACKS.length)];
  }
  return track;
}

function getMusicGain(ctx) {
  if (!musicGain) {
    musicGain = ctx.createGain();
    musicGain.gain.value = 0;
    musicGain.connect(ctx.destination);
  }
  return musicGain;
}

function fadeOutCurrent(ctx) {
  if (!currentSource || !musicGain) return 0;

  const source = currentSource;
  currentSource = null;
  const now = ctx.currentTime;
  musicGain.gain.cancelScheduledValues(now);
  musicGain.gain.setValueAtTime(musicGain.gain.value, now);
  musicGain.gain.linearRampToValueAtTime(0, now + FADE_SECONDS);
  try {
    source.stop(now + FADE_SECONDS);
  } catch {
    // The source may already have ended or been stopped by another transition.
  }
  return FADE_SECONDS;
}

async function startPendingTrack(id, earliestStart = 0) {
  const url = currentUrl;
  if (!url || !musicEnabled || !isMusicOn()) return;

  const ctx = ensureContext();
  if (!ctx) return;
  const buffer = await loadTrack(url);
  if (!buffer || id !== transitionId || url !== currentUrl || !musicEnabled || !isMusicOn()) return;

  const gain = getMusicGain(ctx);
  const source = ctx.createBufferSource();
  const startAt = Math.max(ctx.currentTime, earliestStart);
  source.buffer = buffer;
  source.loop = true;
  source.connect(gain);

  gain.gain.cancelScheduledValues(ctx.currentTime);
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(MUSIC_VOLUME, startAt + FADE_SECONDS);
  source.start(startAt);
  currentSource = source;
}

export function playGroup(group) {
  if (group !== 'menu' && group !== 'gameplay') return;

  // Menu scenes share one uninterrupted selection. BoardScene is the
  // gameplay entry point and intentionally chooses a fresh track every time.
  if (group === 'menu' && activeGroup === 'menu') return;

  activeGroup = group;
  const previousUrl = currentUrl;
  currentUrl = pickRandomTrack(previousUrl);
  musicEnabled = isMusicOn();
  const id = ++transitionId;

  if (!musicEnabled) {
    if (musicGain) fadeOutCurrent(musicGain.context);
    return;
  }

  const ctx = ensureContext();
  if (!ctx) return;
  const delay = fadeOutCurrent(ctx);
  startPendingTrack(id, ctx.currentTime + delay);
}

export function stopMusic() {
  ++transitionId;
  if (musicGain) fadeOutCurrent(musicGain.context);
}

export function setMusicEnabled(on) {
  musicEnabled = Boolean(on);
  const id = ++transitionId;

  if (!musicEnabled) {
    if (musicGain) fadeOutCurrent(musicGain.context);
    return;
  }

  if (currentSource) {
    ensureContext();
    return;
  }
  if (currentUrl) startPendingTrack(id);
}
