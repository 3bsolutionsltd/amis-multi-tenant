/// <reference lib="webworker" />
import { precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { StaleWhileRevalidate } from "workbox-strategies";

declare const self: ServiceWorkerGlobalScope;

// Injected by vite-plugin-pwa at build time
precacheAndRoute(self.__WB_MANIFEST);

// Cache API GET responses for student and marks lists (stale-while-revalidate)
registerRoute(
  ({ url }) =>
    url.pathname.startsWith("/students") || url.pathname.startsWith("/marks"),
  new StaleWhileRevalidate({ cacheName: "amis-api-cache" }),
);

// Background Sync: flush offline queue when connectivity is restored
self.addEventListener("sync", (event: SyncEvent) => {
  if (event.tag === "outbox-flush") {
    event.waitUntil(flushOfflineQueue());
  }
});

async function flushOfflineQueue(): Promise<void> {
  const DB_NAME = "amis-offline";
  const STORE_NAME = "outbox";

  const db = await openDB();
  const items = await getAllPending(db);

  if (items.length === 0) return;

  try {
    const response = await fetch("/sync/flush", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });

    if (response.ok) {
      await clearFlushed(db, items.map((i) => i.id));
    }
  } finally {
    db.close();
  }

  function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
      req.onupgradeneeded = (e) => {
        const database = (e.target as IDBOpenDBRequest).result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME, {
            keyPath: "id",
            autoIncrement: true,
          });
        }
      };
    });
  }

  function getAllPending(
    database: IDBDatabase,
  ): Promise<Array<{ id: number; [key: string]: unknown }>> {
    return new Promise((resolve, reject) => {
      const tx = database.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
    });
  }

  function clearFlushed(
    database: IDBDatabase,
    ids: number[],
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = database.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      ids.forEach((id) => store.delete(id));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}
