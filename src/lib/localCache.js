const DB_NAME = "buildcore-pm-cache";
const DB_VERSION = 1;
const STORE_NAME = "workspaces";

function openCacheDb() {
  if (!("indexedDB" in window)) return Promise.resolve(null);

  return new Promise((resolve) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: "key" });
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

async function withStore(mode, action) {
  const db = await openCacheDb();
  if (!db) return null;

  return new Promise((resolve) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const request = action(store);

    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => resolve(null);
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => db.close();
  });
}

export async function readCachedWorkspace(userId) {
  if (!userId) return null;
  return withStore("readonly", (store) => store.get(`workspace:${userId}`));
}

export async function writeCachedWorkspace(userId, payload) {
  if (!userId || !payload) return null;
  return withStore("readwrite", (store) =>
    store.put({
      key: `workspace:${userId}`,
      cached_at: new Date().toISOString(),
      ...payload,
    }),
  );
}
