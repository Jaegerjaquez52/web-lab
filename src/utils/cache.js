const store = new Map();

export function cacheGet(key) {
  const hit = store.get(key);
  if (!hit || hit.expiresAt < Date.now()) {
    store.delete(key);
    return null;
  }
  return hit.value;
}

export function cacheSet(key, value, ttlMs = 20_000) {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function cacheDel(prefix) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
