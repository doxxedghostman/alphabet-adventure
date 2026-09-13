// Auth store - Google sign-in via Supabase, session state, and the
// guest-to-cloud merge that runs the first time someone signs in.
//
// Account model (decided, see PLAN.md §8.6 / update.md Milestone 25):
// guest play is never blocked - this store is only ever invoked from
// user-initiated taps (Settings' "Sign in with Google" row, eventually
// a post-level-win prompt), never automatically on load. A guest who
// never signs in never touches Supabase at all.
//
// OAuth flow shape: signInWithOAuth() redirects the whole page to
// Google and back (standard web OAuth redirect, not a popup) - see
// signInWithGoogle() below for why, and initAuth()'s comment for how
// the merge gets triggered after the redirect returns.
import { supabase } from './supabaseClient.js';
import { getCompletedLevelIds, setCompletedLevelIds } from './progressStore.js';
import { getSettings, setMusicOn, setSfxOn, setHapticsOn } from './settingsStore.js';

let cachedUser = null;
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
}

/** Starts the Google OAuth flow. Full-page redirect (not a popup) -
 * this is a Capacitor/WebView app, and popup-based OAuth is unreliable
 * or outright blocked in WebViews on some devices, whereas a plain
 * redirect works the same everywhere. redirectTo brings the user back
 * to wherever they started (this same page/app), where initAuth()'s
 * onAuthStateChange listener picks up the new session automatically. */
export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + window.location.pathname,
    },
  });
  if (error) {
    console.warn('signInWithGoogle failed', error);
    return { error };
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
