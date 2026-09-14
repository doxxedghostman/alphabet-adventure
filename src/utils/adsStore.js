// Rewarded video ads — Home Hub's Video icon ("Watch to Earn"). Real
// AdMob IDs (from the WordSwoop AdMob app, "Rewarded" ad format, not
// "Rewarded interstitial" - this one is opt-in only, matching an icon
// the player has to tap):
//   App ID (AndroidManifest.xml):        ca-app-pub-2830006716687955~2244040404
//   Rewarded ad unit ID (used below):    ca-app-pub-2830006716687955/8286704574
//
// The reward is a weighted random pick from REWARD_POOL below (mostly
// gems, Bomb/Shuffle/Life rare) rather than a fixed 10 gems - decided
// in chat after Lives/Bomb/Shuffle became real, spendable things worth
// occasionally handing out here too. AdMob's own "reward amount"
// field (set to "10 Gems" when the ad unit was created) is just for
// its dashboard reporting to look sane; the actual grant logic and
// amount live entirely in this file, independent of that setting.
//
// @capacitor-community/admob's web implementation is a no-op stub
// that always resolves with { amount: 0 } (see its web.js) - that's
// exactly the signal used below to mean "no real ad watched, don't
// grant anything" on both a genuinely-dismissed-without-reward native
// ad AND on web/dev preview, so no platform-specific gem-skipping
// logic is needed here - just checking the resolved amount handles
// both cases via the same code path.

import { AdMob } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';
import { addGems } from './currencyStore.js';
import { addBooster } from './boosterStore.js';
import { addLives } from './livesStore.js';

const AD_UNIT_ID = 'ca-app-pub-2830006716687955/8286704574';
const GEM_REWARD_AMOUNT = 10;

// Weighted reward pool, per chat: mostly gems, with Bomb/Shuffle/Life
// deliberately rare ("hard to earn") rather than an even split - gems
// are the safe, always-useful default; the others are a nice surprise
// on top, not something to expect from every watch.
const REWARD_POOL = [
  { type: 'gems', weight: 70 },
  { type: 'bomb', weight: 10 },
  { type: 'shuffle', weight: 10 },
  { type: 'life', weight: 10 },
];

function pickReward() {
  const totalWeight = REWARD_POOL.reduce((sum, r) => sum + r.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const reward of REWARD_POOL) {
    if (roll < reward.weight) return reward.type;
    roll -= reward.weight;
  }
  return 'gems'; // unreachable in practice, just a safe fallback
}

function grantReward(type) {
  switch (type) {
    case 'bomb':
      addBooster('bomb');
      return { type: 'bomb', amount: 1 };
    case 'shuffle':
      addBooster('shuffle');
      return { type: 'shuffle', amount: 1 };
    case 'life':
      addLives(1);
      return { type: 'life', amount: 1 };
    case 'gems':
    default:
      addGems(GEM_REWARD_AMOUNT);
      return { type: 'gems', amount: GEM_REWARD_AMOUNT };
  }
}

let initialized = false;

/** Must run once before the first ad request - call at app boot on
 * native only (see main.js). No-ops on web. */
export async function initAds() {
  if (!Capacitor.isNativePlatform() || initialized) return;
  initialized = true;
  try {
    await AdMob.initialize();
  } catch (err) {
    console.warn('initAds: AdMob failed to initialize', err);
  }
}

/** Loads and shows the ad, resolving true only if the player watched
 * it through (native platform + real reward earned), false otherwise.
 * Shared by both showRewardedAd() (random pool) and
 * showRewardedAdForLife() (guaranteed life) below. */
async function playRewardedAdToCompletion() {
  if (!Capacitor.isNativePlatform()) return { watched: false, reason: 'not-native' };
  try {
    await AdMob.prepareRewardVideoAd({ adId: AD_UNIT_ID });
    const result = await AdMob.showRewardVideoAd();
    if (result && result.amount > 0) return { watched: true };
    return { watched: false, reason: 'dismissed' };
  } catch (err) {
    console.warn('playRewardedAdToCompletion: failed to load/show ad', err);
    return { watched: false, reason: 'error', error: err };
  }
}

/**
 * Loads and shows a rewarded ad, granting a reward (see REWARD_POOL)
 * only if the player actually watched it through.
 *
 * Returns one of:
 *   { granted: true, type, amount }        - reward earned
 *   { granted: false, reason: 'not-native' } - running in a browser/preview
 *   { granted: false, reason: 'dismissed' }  - ad shown but closed early
 *   { granted: false, reason: 'error', error } - failed to load/show
 */
export async function showRewardedAd() {
  const outcome = await playRewardedAdToCompletion();
  if (!outcome.watched) return { granted: false, reason: outcome.reason, error: outcome.error };
  const reward = grantReward(pickReward());
  return { granted: true, ...reward };
}

/**
 * Same ad, but always grants exactly 1 life instead of the random
 * pool - used by BoardScene's "Out of Lives" wall, where a guaranteed
 * refill is the whole point (matches the classic "watch an ad for a
 * life" pattern), not a chance at one among other rewards.
 */
export async function showRewardedAdForLife() {
  const outcome = await playRewardedAdToCompletion();
  if (!outcome.watched) return { granted: false, reason: outcome.reason, error: outcome.error };
  addLives(1);
  return { granted: true, type: 'life', amount: 1 };
}
