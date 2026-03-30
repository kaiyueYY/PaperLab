export interface SearchHistoryRecord {
  id: number;
  topic: string;
  createdAt: string;
}

const DB_NAME = 'paperlab-db';
const DB_VERSION = 1;
const STORE_NAME = 'search_history';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

export async function listSearchHistory(limit = 8): Promise<SearchHistoryRecord[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const records = (request.result as SearchHistoryRecord[])
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, limit);
      resolve(records);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function addSearchHistory(topic: string): Promise<void> {
  const normalized = topic.trim();
  if (!normalized) {
    return;
  }

  const db = await openDb();
  const existing = await listSearchHistory(100);
  const duplicate = existing.find((record) => record.topic.toLowerCase() === normalized.toLowerCase());

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    if (duplicate) {
      store.delete(duplicate.id);
    }

    store.add({
      topic: normalized,
      createdAt: new Date().toISOString(),
    });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
