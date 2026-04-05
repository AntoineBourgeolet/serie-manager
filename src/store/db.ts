const DB_NAME = 'serie-manager';
const DB_VERSION = 1;
const STORE_NAME = 'series';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result as IDBDatabase);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

export async function dbGetAll<T>(): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

export async function dbPutAll<T extends { id: string }>(items: T[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const clearReq = store.clear();
    clearReq.onsuccess = () => {
      if (items.length === 0) {
        resolve();
        return;
      }
      let pending = items.length;
      items.forEach((item) => {
        const putReq = store.put(item);
        putReq.onsuccess = () => {
          pending--;
          if (pending === 0) resolve();
        };
        putReq.onerror = () => reject(putReq.error);
      });
    };
    clearReq.onerror = () => reject(clearReq.error);
    tx.onerror = () => reject(tx.error);
  });
}

export function isIndexedDBAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}
