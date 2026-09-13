// Auth store - Google sign-in via Supabase, session state, and the
// guest-to-cloud merge that runs the first time someone signs in.
//
// Account model (decided, see PLAN.md §8.6 / update.md Milestone 25):
// guest play is never blocked - this store is only ever invoked from
// user-initiated taps (Settings' "Sign in with Google" row, eventually
// a post-level-win prompt), never automatically on load. A guest who
// never signs in never touches Supabase at all.
//
// OAuth flow shape: signInWithGoogle() opens Google's consent screen in
// the *system* browser via @capacitor/browser, not this app's own
// WebView - Google blocks its OAuth screen from loading inside embedded
// WebViews outright, so an in-app redirect can never work here. The
// system browser hands control back via a custom URL scheme
// (AUTH_REDIRECT_URL below), caught by initAuth()'s appUrlOpen listener,
// which is what actually completes the sign-in and triggers the merge.
import { Browser } from '@capacitor/browser';
import { App } from '@capacitor/app';
import { supabase } from './supabaseClient.js';
import { getCompletedLevelIds, setCompletedLevelIds } from './progressStore.js';
import { getSettings, setMusicOn, setSfxOn, setHapticsOn } from './settingsStore.js';
import { getGems } from './currencyStore.js';

// Google actively blocks its OAuth consent screen from loading inside an
// embedded WebView (the exact environment this Capacitor app runs in) -
// it detects the WebView user agent and refuses with "Error 403:
// disallowed_useragent" / "This browser or app may not be secure",
// regardless of how correctly Google Cloud/Supabase are configured. The
// fix isn't a config change, it's that Google sign-in has to happen in
// the *system* browser (Chrome Custom Tabs), not this app's WebView -
// hence Browser.open() below instead of an in-page redirect, and the
// custom URL scheme to hand control back once Google's done. This must
// match an intent-filter in AndroidManifest.xml and be added to
// Supabase's Authentication -> URL Configuration -> Redirect URLs list.
const AUTH_REDIRECT_URL = 'com.wobblewingstudios.wordswoop://auth-callback';

let cachedUser = null;
let appUrlListenerRegistered = false;
const listeners = new Set();

function notifyListeners() {
  listeners.forEach((fn) => fn(cachedUser));
}

/** Subscribe to sign-in/sign-out changes. Returns an unsubscribe fn.
 * Fires immediately with the current state on subscribe, so a scene
 * doesn't have to separately call getCurrentUser() first. */
export function onAuthChange(callback) {
  listeners.add(callback);
  callback(cachedUser);
  return () => listeners.delete(callback);
}

export function getCurrentUser() {
  return cachedUser;
}

export function isSignedIn() {
  return cachedUser !== null;
}

/** Pushes current local progress (completed levels + gems) up to this
 * user's cloud profile - a no-op for guests. Called after anything
 * that changes either (BoardScene on level win, CalendarScene on
 * claim) so the Leaderboard (which reads wordswoop_profiles directly,
 * not local storage) stays current for signed-in players. Fire-and-
 * forget, same as initAuth() - a failed sync shouldn't interrupt
 * gameplay, it just means the leaderboard lags until the next
 * successful call. */
export async function syncLocalProgressToCloud() {
  if (!cachedUser) return;

  const { error } = await supabase
    .from('wordswoop_profiles')
    .update({ completed_level_ids: getCompletedLevelIds(), gems: getGems() })
    .eq('id', cachedUser.id);

  if (error) console.warn('syncLocalProgressToCloud: failed to sync', error);
}

/** Google's profile picture URL, checking both key names Supabase might
 * normalize it to (see wordswoop_handle_new_user's SQL comment - same
 * variance applies reading it back client-side). */
export function getAvatarUrl() {
  if (!cachedUser) return null;
  const meta = cachedUser.user_metadata || {};
  return meta.avatar_url || meta.picture || null;
}

export function getDisplayName() {
  if (!cachedUser) return null;
  const meta = cachedUser.user_metadata || {};
  return meta.full_name || meta.name || null;
}

/** Call once on app startup (main.js) to pick up an existing session
 * (someone who signed in last time and closed the app) and to react to
 * the redirect back from Google. Everything after this is push-based
 * via onAuthChange(). */
export async function initAuth() {
  const { data } = await supabase.auth.getSession();
  cachedUser = data.session?.user ?? null;
  notifyListeners();

  supabase.auth.onAuthStateChange(async (event, session) => {
    const wasSignedIn = cachedUser !== null;
    cachedUser = session?.user ?? null;
    notifyListeners();

    // Only run the merge the moment someone goes from signed-out to
    // signed-in (covers both "just completed the Google redirect" and
    // "session restored on a fresh load isn't a new sign-in" - the
    // latter already has its cloud state, nothing local to reconcile
    // against a session that was already synced).
    if (!wasSignedIn && cachedUser) {
      await mergeGuestProgressIntoCloud(cachedUser.id);
    }
  });

  // Catches the deep link back from the system browser once Google
  // sign-in completes (see AUTH_REDIRECT_URL above). Registered once -
  // initAuth() itself only ever runs once, at boot, but guard anyway
  // since App listeners would otherwise stack up on any future re-init.
  if (!appUrlListenerRegistered) {
    appUrlListenerRegistered = true;
    App.addListener('appUrlOpen', async ({ url }) => {
      if (!url || !url.startsWith(AUTH_REDIRECT_URL)) return;

      const code = new URL(url).searchParams.get('code');
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) console.warn('exchangeCodeForSession failed', error);
        // onAuthStateChange above picks up the resulting session and
        // runs the guest-to-cloud merge - nothing else to do here.
      }
      await Browser.close();
    });
  }
}

/** Starts the Google OAuth flow in the system browser (see the file
 * header comment for why it can't run in this app's own WebView).
 * initAuth()'s appUrlOpen listener picks up the redirect back and
 * completes the sign-in via exchangeCodeForSession(). */
export async function signInWithGoogle() {
  // skipBrowserRedirect: true - don't let supabase-js try to navigate
  // this WebView anywhere; it just returns the Google auth URL, which
  // Browser.open() then loads in the system browser instead (the part
  // that actually gets past Google's embedded-WebView block).
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: AUTH_REDIRECT_URL,
      skipBrowserRedirect: true,
    },
  });
  if (error) {
    console.warn('signInWithGoogle failed', error);
    return { error };
  }
  if (data?.url) {
    await Browser.open({ url: data.url });
  }
  return { error: null };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) console.warn('signOut failed', error);
  return { error };
}

/** Runs once, right after a guest's first sign-in. Per chat: merge, not
 * overwrite - union local + cloud completed levels (a guest could have
 * real progress worth keeping), and only push local settings up if this
 * is genuinely the account's first sync (cloud row untouched since
 * creation); otherwise the cloud's own settings win and get pulled down
 * locally, so a returning user's saved preferences aren't clobbered by
 * whatever the new device's local defaults happen to be. */
async function mergeGuestProgressIntoCloud(userId) {
  const { data: profile, error } = await supabase
    .from('wordswoop_profiles')
    .select('completed_level_ids, settings, created_at, updated_at')
    .eq('id', userId)
    .single();

  if (error || !profile) {
    console.warn('mergeGuestProgressIntoCloud: could not load profile', error);
    return;
  }

  const localCompleted = getCompletedLevelIds();
  const cloudCompleted = new Set(profile.completed_level_ids || []);
  const merged = [...new Set([...localCompleted, ...cloudCompleted])];

  // The auto-provisioning trigger sets created_at === updated_at at
  // creation time; if a settings write already happened since (on any
  // device), they'll have drifted apart. Cheap way to tell "never
  // touched" apart from "already synced once" without a separate flag
  // column.
  const isFirstSync = profile.created_at === profile.updated_at;
  const settingsToSave = isFirstSync ? getSettings() : profile.settings;

  const { error: updateError } = await supabase
    .from('wordswoop_profiles')
    .update({ completed_level_ids: merged, settings: settingsToSave })
    .eq('id', userId);

  if (updateError) {
    console.warn('mergeGuestProgressIntoCloud: failed to write merged profile', updateError);
    return;
  }

  // Write the merged/pulled state back to local storage too, so both
  // sides agree after this - completed levels always merge upward;
  // settings only get overwritten locally when they came FROM the
  // cloud (i.e. this wasn't the first sync).
  setCompletedLevelIds(merged);
  if (!isFirstSync && settingsToSave) {
    if (typeof settingsToSave.musicOn === 'boolean') setMusicOn(settingsToSave.musicOn);
    if (typeof settingsToSave.sfxOn === 'boolean') setSfxOn(settingsToSave.sfxOn);
    if (typeof settingsToSave.hapticsOn === 'boolean') setHapticsOn(settingsToSave.hapticsOn);
  }
}
