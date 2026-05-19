// IndexedDB-backed WASM cache + localStorage opt-out flag.
// In simulation mode the "blob" is a tiny sentinel so the UI flow is identical.

const DB_NAME    = "rootless-linux-bench";
const DB_VERSION = 1;
const STORE      = "wasm-blobs";

const OPT_OUT_KEY = "rlb-cache-optout";

export function isCacheEnabled() {
  return localStorage.getItem(OPT_OUT_KEY) !== "1";
}

export function setCacheEnabled(val) {
  localStorage.setItem(OPT_OUT_KEY, val ? "0" : "1");
}

function openDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => e.target.result.createObjectStore(STORE);
    req.onsuccess = (e) => res(e.target.result);
    req.onerror  = () => rej(req.error);
  });
}

export async function getCached(id) {
  if (!isCacheEnabled()) return null;
  try {
    const db = await openDB();
    return await new Promise((res, rej) => {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).get(id);
      req.onsuccess = () => res(req.result ?? null);
      req.onerror  = () => rej(req.error);
    });
  } catch { return null; }
}

// Store any serialisable value (ArrayBuffer for real WASM, "sim" sentinel for demo).
export async function putCached(id, value) {
  if (!isCacheEnabled()) return;
  try {
    const db = await openDB();
    await new Promise((res, rej) => {
      const req = db.transaction(STORE, "readwrite").objectStore(STORE).put(value, id);
      req.onsuccess = () => res();
      req.onerror  = () => rej(req.error);
    });
  } catch { /* silently ignore */ }
}

export async function clearCache(id) {
  try {
    const db = await openDB();
    if (id) {
      await new Promise((res, rej) => {
        const req = db.transaction(STORE, "readwrite").objectStore(STORE).delete(id);
        req.onsuccess = () => res();
        req.onerror  = () => rej(req.error);
      });
    } else {
      // Clear all
      await new Promise((res, rej) => {
        const req = db.transaction(STORE, "readwrite").objectStore(STORE).clear();
        req.onsuccess = () => res();
        req.onerror  = () => rej(req.error);
      });
    }
  } catch { /* ignore */ }
}

export async function getCacheSize() {
  try {
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      return est.usage ?? 0;
    }
  } catch { }
  return 0;
}
