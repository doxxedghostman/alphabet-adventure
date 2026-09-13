// Daily reward (Home Hub's Calendar icon) — per chat: a 7-day
// check-in cycle. Days 1-3 pay 3 gems, days 4-6 pay 5 gems, day 7
// pays a random booster (see boosterStore.js) instead of gems, then
// the cycle repeats from day 1. Missing a day resets the streak back
// to day 1 rather than just pausing it — the stricter, more common
// pattern for this kind of daily-login loop.
//
// Same single-JSON-blob-in-localStorage pattern as the other stores.
// Dates are compared as local YYYY-MM-DD strings (not timestamps) so
// "today"/"yesterday" match the player's own calendar day rather than
// a rolling 24h window.

import { addGems } from './currencyStore.js';
import { addBooster, randomBoosterType } from './boosterStore.js';

const STORAGE_KEY = 'wordswoop_daily_reward';

export const REWARD_SCHEDULE = [
  { day: 1, type: 'gems', amount: 3 },
  { day: 2, type: 'gems', amount: 3 },
  { day: 3, type: 'gems', amount: 3 },
  { day: 4, type: 'gems', amount: 5 },
  { day: 5, type: 'gems', amount: 5 },
  { day: 6, type: 'gems', amount: 5 },
  { day: 7, type: 'booster', amount: 1 },
];

function dateStr(date) {
  // Local calendar date as YYYY-MM-DD, not UTC — a player at 11pm
  // shouldn't have "today" roll over based on UTC's clock.
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function todayStr() {
  return dateStr(new Date());
}

function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dateStr(d);
}

function loadRaw() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { streakDay: 0, lastClaimDate: null };
    const parsed = JSON.parse(raw);
    return {
      streakDay: typeof parsed.streakDay === 'number' ? parsed.streakDay : 0,
      lastClaimDate: typeof parsed.lastClaimDate === 'string' ? parsed.lastClaimDate : null,
    };
  } catch (err) {
    console.warn('dailyRewardStore: failed to read localStorage, starting fresh', err);
    return { streakDay: 0, lastClaimDate: null };
  }
}

function saveRaw(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('dailyRewardStore: failed to write localStorage', err);
  }
}

/**
 * Read-only status for rendering the calendar. Never mutates storage —
 * viewing the screen must not consume today's claim or reset a streak
 * on its own, only calling claimToday() does.
 *
 * Returns:
 *   claimedToday  - true if today's reward was already claimed
 *   currentDay    - the day (1-7) that's claimed (if claimedToday) or
 *                    about to be claimed (if not)
 *   willReset     - true if a day was missed and claiming today would
 *                    restart the cycle at day 1
 */
export function getStatus() {
  const { streakDay, lastClaimDate } = loadRaw();
  const today = todayStr();

  if (lastClaimDate === today) {
    return { claimedToday: true, currentDay: streakDay, willReset: false };
  }

  if (lastClaimDate === yesterdayStr()) {
    const nextDay = (streakDay % 7) + 1;
    return { claimedToday: false, currentDay: nextDay, willReset: false };
  }

  // No claim yet, or a day (or more) was missed.
  return { claimedToday: false, currentDay: 1, willReset: streakDay !== 0 };
}

/**
 * Claims today's reward. No-ops (returns null) if already claimed
 * today. Grants the reward via currencyStore/boosterStore and returns
 * { day, reward } describing what was just granted.
 */
export function claimToday() {
  const status = getStatus();
  if (status.claimedToday) return null;

  const day = status.currentDay;
  const schedule = REWARD_SCHEDULE[day - 1];

  let reward;
  if (schedule.type === 'gems') {
    addGems(schedule.amount);
    reward = { type: 'gems', amount: schedule.amount };
  } else {
    const boosterType = randomBoosterType();
    addBooster(boosterType);
    reward = { type: 'booster', boosterType, amount: schedule.amount };
  }

  saveRaw({ streakDay: day, lastClaimDate: todayStr() });
  return { day, reward };
}
