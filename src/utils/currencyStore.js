// Local balance plus a persistent operation stream for retry-safe cloud sync.
// A stream's cumulative delta is acknowledged in the cloud profile settings.
const STORAGE_KEY = 'wordswoop_currency';
const listeners = new Set();
const validGems = (value) => Number.isSafeInteger(value) && value >= 0;
const streamId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const fresh = (ownerId = null) => ({ gems: 0, ownerId, streamId: streamId(), delta: 0, legacyGems: null });

function read(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function write(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch (error) { console.warn('currencyStore: storage unavailable', error); }
}
function saveRaw(data) {
  write(STORAGE_KEY, data);
  if (data.ownerId) write(`${STORAGE_KEY}:${data.ownerId}`, data);
}
function loadRaw() {
  const stored = read(STORAGE_KEY);
  if (validGems(stored?.gems) && typeof stored.streamId === 'string' && Number.isSafeInteger(stored.delta)) return stored;
  const data = fresh();
  // Older versions uploaded an absolute balance. Keep the higher legacy/cloud
  // balance on first migration rather than counting those same gems twice.
  if (validGems(stored?.gems)) data.gems = data.legacyGems = stored.gems;
  saveRaw(data);
  return data;
}
function notify(kind) { listeners.forEach((listener) => listener(kind)); }
export function onGemsChanged(listener) { listeners.add(listener); return () => listeners.delete(listener); }
export function getGems() { return loadRaw().gems; }

export function addGems(amount) {
  if (!Number.isSafeInteger(amount)) throw new Error('Gem amounts must be whole numbers');
  const data = loadRaw();
  const next = Math.max(0, data.gems + amount);
  data.delta += next - data.gems;
  data.gems = next;
  saveRaw(data);
  notify('local');
  return data.gems;
}

// Keep account balances separate on shared devices. A guest's unspent balance
// transfers once; signing out starts a fresh guest wallet.
export function setGemAccount(ownerId) {
  const current = loadRaw();
  if (current.ownerId === ownerId) return;
  if (current.ownerId) write(`${STORAGE_KEY}:${current.ownerId}`, current);
  const saved = ownerId ? read(`${STORAGE_KEY}:${ownerId}`) : null;
  let next = saved?.ownerId === ownerId && validGems(saved.gems) ? saved : fresh(ownerId);
  if (ownerId && !current.ownerId) {
    if (!saved) next = { ...current, ownerId };
    else { next.gems += current.gems; next.delta += current.gems; }
  }
  saveRaw(next);
  notify('account');
}

export function getGemSyncSnapshot(ownerId) {
  const data = loadRaw();
  return data.ownerId === ownerId ? { ...data } : null;
}

export function applyGemSync(snapshot, cloudGems) {
  const data = loadRaw();
  if (data.ownerId !== snapshot.ownerId || data.streamId !== snapshot.streamId) return;
  // Preserve rewards/spending made while the network request was in flight.
  data.gems = Math.max(0, cloudGems + data.delta - snapshot.delta);
  data.legacyGems = null;
  saveRaw(data);
  notify('sync');
}
