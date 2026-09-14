// Rewarded video ads — Home Hub's Video icon ("Watch to Earn"). Real
// AdMob IDs (from the WordSwoop AdMob app, "Rewarded" ad format, not
// "Rewarded interstitial" - this one is opt-in only, matching an icon
// the player has to tap):
//   App ID (AndroidManifest.xml):        ca-app-pub-2830006716687955~2244040404
//   Rewarded ad unit ID (used below):    ca-app-pub-2830006716687955/8286704574
//
// Reward is fixed at 10 gems here in our own code, not read from
// AdMob's "reward amount" field (also set to 10 when the ad unit was
// created, purely so AdMob's own dashboard reporting matches reality)
// - our economy is defined by us, not by a value sitting in a third-
// party console.
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

const AD_UNIT_ID = 'ca-app-pub-2830006716687955/8286704574';
const REWARD_GEMS = 10;

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

/**
 * Loads and shows a rewarded ad, granting gems only if the player
 * actually watched it through.
 *
 * Returns one of:
 *   { granted: true, amount }              - reward earned
 *   { granted: false, reason: 'not-native' } - running in a browser/preview
 *   { granted: false, reason: 'dismissed' }  - ad shown but closed early
 *   { granted: false, reason: 'error', error } - failed to load/show
 */
export async function showRewardedAd() {
  if (!Capacitor.isNativePlatform()) {
    return { granted: false, reason: 'not-native' };
  }

  try {
    await AdMob.prepareRewardVideoAd({ adId: AD_UNIT_ID });
    const result = await AdMob.showRewardVideoAd();
    if (result && result.amount > 0) {
      addGems(REWARD_GEMS);
      return { granted: true, amount: REWARD_GEMS };
    }
    return { granted: false, reason: 'dismissed' };
  } catch (err) {
    console.warn('showRewardedAd: failed to load/show ad', err);
    return { granted: false, reason: 'error', error: err };
  }
}
