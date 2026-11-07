import { getCompletedLevelIds, setCompletedLevelIds } from './progressStore.js';
import { getSettings, setMusicOn, setSfxOn, setHapticsOn } from './settingsStore.js';
import { getGemSyncSnapshot, applyGemSync } from './currencyStore.js';

const levelIds = (value) => Array.isArray(value) ? value.filter((id) => Number.isInteger(id) && id >= 1 && id <= 200) : [];

// Receipt-based deltas make retries idempotent, including a lost response after
// a successful write. updated_at comparison prevents two devices losing updates.
export function reconcileProfile(profile, snapshot, completed, localSettings, pullSettings = false) {
  const remoteGems = Number.isSafeInteger(profile.gems) && profile.gems >= 0 ? profile.gems : 0;
  const settings = profile.settings && typeof profile.settings === 'object' && !Array.isArray(profile.settings) ? profile.settings : {};
  const receipts = settings._gemReceipts && typeof settings._gemReceipts === 'object' ? settings._gemReceipts : {};
  const previous = receipts[snapshot.streamId];
  const acknowledged = Number.isSafeInteger(previous?.delta) ? previous.delta : 0;
  const legacyCredit = previous ? 0 : Math.max(0, (snapshot.legacyGems ?? 0) - remoteGems);
  const gems = Math.max(0, remoteGems + snapshot.delta - acknowledged + legacyCredit);
  const preferences = pullSettings && profile.created_at !== profile.updated_at ? settings : localSettings;
  return {
    gems,
    completed_level_ids: [...new Set([...levelIds(profile.completed_level_ids), ...levelIds([...completed])])],
    settings: { ...settings, ...preferences, _gemReceipts: { ...receipts, [snapshot.streamId]: { delta: snapshot.delta } } },
  };
}

export async function syncProfile(client, userId, isCurrent = () => true, pullSettings = false) {
  for (let attempt = 0; attempt < 4; attempt++) {
    if (!isCurrent()) return false;
    const { data: profile, error } = await client.from('wordswoop_profiles')
      .select('completed_level_ids, gems, settings, created_at, updated_at').eq('id', userId).single();
    if (error || !profile) throw error || new Error('Cloud profile is unavailable');
    if (!isCurrent()) return false;
    const snapshot = getGemSyncSnapshot(userId);
    if (!snapshot) return false;
    const update = reconcileProfile(profile, snapshot, getCompletedLevelIds(), getSettings(), pullSettings);
    const { data: written, error: writeError } = await client.from('wordswoop_profiles')
      .update(update).eq('id', userId).eq('updated_at', profile.updated_at).eq('gems', profile.gems)
      .select('id').maybeSingle();
    if (writeError) throw writeError;
    if (!written) continue; // A concurrent writer won; re-read and reconcile.
    if (!isCurrent()) return false;
    setCompletedLevelIds([...new Set([...getCompletedLevelIds(), ...update.completed_level_ids])]);
    applyGemSync(snapshot, update.gems);
    for (const [key, setter] of [['musicOn', setMusicOn], ['sfxOn', setSfxOn], ['hapticsOn', setHapticsOn]]) {
      if (typeof update.settings[key] === 'boolean') setter(update.settings[key]);
    }
    return true;
  }
  throw new Error('Cloud profile changed repeatedly; progress will retry on the next sync');
}
