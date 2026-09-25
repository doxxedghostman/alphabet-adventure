import { isSfxOn } from './settingsStore.js';

let sharedContext = null;
let sharedNoiseBuffer = null;

export function ensureContext() {
  if (!sharedContext) {
    const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContextClass) return null;
    sharedContext = new AudioContextClass();
  }
  if (sharedContext.state === 'suspended') {
    sharedContext.resume().catch(() => {});
  }
  return sharedContext;
}

export function init() {
  return ensureContext();
}

function addTone(ctx, frequency, start, duration, options = {}) {
  const {
    type = 'sine',
    volume = 0.08,
    endFrequency = frequency,
    attack = 0.012,
  } = options;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  const end = start + duration;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), end);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + Math.min(attack, duration * 0.3));
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(end + 0.01);
}

function getNoiseBuffer(ctx) {
  if (sharedNoiseBuffer) return sharedNoiseBuffer;
  const length = Math.ceil(ctx.sampleRate * 0.5);
  sharedNoiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const samples = sharedNoiseBuffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  return sharedNoiseBuffer;
}

function addNoise(ctx, start, duration, options = {}) {
  const {
    volume = 0.08,
    filterStart = 5000,
    filterEnd = 700,
    filterType = 'lowpass',
  } = options;
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  const end = start + duration;

  source.buffer = getNoiseBuffer(ctx);
  filter.type = filterType;
  filter.frequency.setValueAtTime(filterStart, start);
  filter.frequency.exponentialRampToValueAtTime(Math.max(20, filterEnd), end);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start(start);
  source.stop(end + 0.01);
}

function addTriad(ctx, start, frequencies, volume = 0.065) {
  frequencies.forEach((frequency, index) => {
    addTone(ctx, frequency, start + index * 0.045, 0.2, {
      type: 'sine',
      volume,
      endFrequency: frequency * 1.015,
    });
  });
}

export function playMatchChime() {
  if (!isSfxOn()) return;
  const ctx = ensureContext();
  if (!ctx) return;
  addTriad(ctx, ctx.currentTime, [523.25, 659.25, 783.99]);
}

export function playShatterClear() {
  if (!isSfxOn()) return;
  const ctx = ensureContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  addNoise(ctx, now, 0.18, { volume: 0.09, filterStart: 6500, filterEnd: 850 });
  [1700, 1350, 1050].forEach((frequency, index) => {
    addTone(ctx, frequency, now + index * 0.025, 0.075, {
      type: 'square', volume: 0.025, endFrequency: frequency * 0.45, attack: 0.003,
    });
  });
}

export function playInvalidSwap() {
  if (!isSfxOn()) return;
  const ctx = ensureContext();
  if (!ctx) return;
  addTone(ctx, 150, ctx.currentTime, 0.19, {
    type: 'sawtooth', volume: 0.07, endFrequency: 82, attack: 0.008,
  });
}

export function playCombo(chainLevel = 1) {
  if (!isSfxOn()) return;
  const ctx = ensureContext();
  if (!ctx) return;
  const semitones = Math.min(Math.max(chainLevel - 1, 0), 7);
  const shift = 2 ** (semitones / 12);
  addTriad(ctx, ctx.currentTime, [523.25 * shift, 659.25 * shift, 783.99 * shift], 0.075);
}

export function playBomb() {
  if (!isSfxOn()) return;
  const ctx = ensureContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  addNoise(ctx, now, 0.34, { volume: 0.1, filterStart: 900, filterEnd: 120 });
  addTone(ctx, 105, now, 0.38, { type: 'sine', volume: 0.14, endFrequency: 43, attack: 0.008 });
}

export function playShuffle() {
  if (!isSfxOn()) return;
  const ctx = ensureContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(260, now);
  oscillator.frequency.exponentialRampToValueAtTime(920, now + 0.16);
  oscillator.frequency.exponentialRampToValueAtTime(360, now + 0.34);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.055, now + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.35);
}

export function playLensHint() {
  if (!isSfxOn()) return;
  const ctx = ensureContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  [1046.5, 1318.51, 1567.98].forEach((frequency, index) => {
    addTone(ctx, frequency, now + index * 0.07, 0.13, { type: 'sine', volume: 0.05 });
  });
}

export function playLevelWin() {
  if (!isSfxOn()) return;
  const ctx = ensureContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((frequency, index) => {
    addTone(ctx, frequency, now + index * 0.065, 0.15, { type: 'triangle', volume: 0.065 });
  });
}

export function playLevelLose() {
  if (!isSfxOn()) return;
  const ctx = ensureContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  [329.63, 293.66, 246.94].forEach((frequency, index) => {
    addTone(ctx, frequency, now + index * 0.1, 0.18, { type: 'sine', volume: 0.055 });
  });
}

export function playGemCollect() {
  if (!isSfxOn()) return;
  const ctx = ensureContext();
  if (!ctx) return;
  addTone(ctx, 1174.66, ctx.currentTime, 0.16, {
    type: 'sine', volume: 0.06, endFrequency: 1567.98,
  });
}

export function playAdReward() {
  if (!isSfxOn()) return;
  const ctx = ensureContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  [659.25, 783.99, 987.77, 1318.51].forEach((frequency, index) => {
    addTone(ctx, frequency, now + index * 0.075, 0.15, { type: 'triangle', volume: 0.06 });
  });
}

export function playUiTap() {
  if (!isSfxOn()) return;
  const ctx = ensureContext();
  if (!ctx) return;
  addTone(ctx, 1050, ctx.currentTime, 0.045, {
    type: 'square', volume: 0.018, endFrequency: 780, attack: 0.002,
  });
}

export function playBoosterEmpty() {
  if (!isSfxOn()) return;
  const ctx = ensureContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  addTone(ctx, 115, now, 0.1, { type: 'square', volume: 0.045, endFrequency: 90, attack: 0.005 });
  addTone(ctx, 92, now + 0.12, 0.14, { type: 'square', volume: 0.04, endFrequency: 65, attack: 0.005 });
}
