const DB_NAME = "buildcore-pm-offline-queue";
const DB_VERSION = 1;
const STORE_NAME = "operations";

function canUseIndexedDb() {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function openQueueDb() {
  if (!canUseIndexedDb()) return Promise.resolve(null);

  return new Promise((resolve) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("userCompany", ["userId", "companyId"], { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

async function withQueueStore(mode, action) {
  const db = await openQueueDb();
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

export function isProbablyOfflineError(error) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const message = String(error?.message || error || "").toLowerCase();
  return (
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("load failed") ||
    message.includes("network request failed") ||
    message.includes("err_network") ||
    message.includes("internet connection")
  );
}

export async function enqueueOfflineOperation(operation) {
  const now = new Date().toISOString();
  const queued = {
    id: operation.id || `${operation.type}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: now,
    updatedAt: now,
    ...operation,
  };
  await withQueueStore("readwrite", (store) => store.put(queued));
  return queued;
}

export async function readOfflineOperations({ companyId, userId } = {}) {
  const rows = await withQueueStore("readonly", (store) => store.getAll());
  return (rows ?? [])
    .filter((row) => (!companyId || row.companyId === companyId) && (!userId || row.userId === userId))
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

export async function deleteOfflineOperation(id) {
  if (!id) return null;
  return withQueueStore("readwrite", (store) => store.delete(id));
}

export async function countOfflineOperations(scope = {}) {
  const rows = await readOfflineOperations(scope);
  return rows.length;
}
