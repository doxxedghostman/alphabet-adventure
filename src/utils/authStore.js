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
import { setGemAccount, onGemsChanged } from './currencyStore.js';
import { syncProfile } from './cloudProgress.js';

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

let syncQueue = Promise.resolve();
let syncState = 'idle';
let settingsUserId = null;
let retryTimer;
let authInitialized = false;
export function getSyncStatus() { return syncState; }

export function syncLocalProgressToCloud() {
  const userId = cachedUser?.id;
  if (!userId) return Promise.resolve(false);
  syncState = 'pending';
  const run = async () => {
    if (cachedUser?.id !== userId) return false;
    try {
      const synced = await syncProfile(supabase, userId, () => cachedUser?.id === userId, settingsUserId !== userId);
      if (cachedUser?.id === userId) {
        if (synced) settingsUserId = userId;
        syncState = synced ? 'synced' : 'idle';
        notifyListeners();
      }
      return synced;
    } catch (error) {
      console.warn('syncLocalProgressToCloud: keeping local progress for retry', error);
      if (cachedUser?.id === userId) { syncState = 'error'; notifyListeners(); }
      return false;
    }
  };
  syncQueue = syncQueue.then(run, run);
  return syncQueue;
}

function scheduleSync() {
  clearTimeout(retryTimer);
  retryTimer = setTimeout(() => syncLocalProgressToCloud(), 250);
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
  if (authInitialized) return;
  authInitialized = true;
  const acceptSession = (session) => {
    const previousId = cachedUser?.id;
    cachedUser = session?.user ?? null;
    if (cachedUser?.id !== previousId) { settingsUserId = null; syncState = 'idle'; }
    setGemAccount(cachedUser?.id ?? null);
    notifyListeners();
    if (cachedUser && cachedUser.id !== previousId) scheduleSync();
  };
  const { data, error } = await supabase.auth.getSession();
  if (!error) acceptSession(data.session);
  // Do network work after the callback returns, and restore cloud state on
  // every app launch, not only the first interactive sign-in.
  supabase.auth.onAuthStateChange((_event, session) => acceptSession(session));
  onGemsChanged((kind) => { if (kind === 'local' && cachedUser) scheduleSync(); });
  if (typeof window !== 'undefined') window.addEventListener('online', scheduleSync);
  App.addListener('appStateChange', ({ isActive }) => { if (isActive) scheduleSync(); });

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
