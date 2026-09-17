import { App } from '@capacitor/app';

// Wires the Android/hardware back gesture to a scene's own "go back"
// navigation, so it's swallowed by in-game navigation instead of
// falling through to Android's default close-the-app behavior.
//
// Call once per scene, from create() - this registers the listener
// immediately and tears it down again on that scene's own 'shutdown'
// event (same lifecycle hook SettingsScene already uses for its auth
// subscription), so at any moment only the currently-active scene has
// a handler wired up - never a single global route, never a pile of
// stale listeners from scenes that have since been torn down.
export function bindHardwareBack(scene, onBack) {
  const listener = App.addListener('backButton', onBack);
  scene.events.once('shutdown', () => {
    listener.then((handle) => handle.remove()).catch(() => {});
  });
}
