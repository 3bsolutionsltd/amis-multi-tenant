import { openDB, type IDBPDatabase } from "idb";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type QueueItemStatus = "pending" | "failed";

export interface QueueItem {
  /** UUID generated at queue time — doubles as the sync event ID */
  id: string;
  url: string;
  method: string;
  body: string | null;
  retryCount: number;
  createdAt: string;
  status: QueueItemStatus;
}

interface AmisOfflineDB {
  outbox: {
    key: string;
    value: QueueItem;
    indexes: { "by-status": QueueItemStatus };
  };
}

// ---------------------------------------------------------------------------
// DB singleton
// ---------------------------------------------------------------------------

let _db: Promise<IDBPDatabase<AmisOfflineDB>> | null = null;

function getDb(): Promise<IDBPDatabase<AmisOfflineDB>> {
  if (!_db) {
    _db = openDB<AmisOfflineDB>("amis-offline", 1, {
      upgrade(db) {
        const store = db.createObjectStore("outbox", { keyPath: "id" });
        store.createIndex("by-status", "status");
      },
    });
  }
  return _db;
}

// ---------------------------------------------------------------------------
// Exported operations
// ---------------------------------------------------------------------------

/** Add a new item to the outbox (always starts as pending, retryCount 0). */
export async function enqueue(
  item: Omit<QueueItem, "retryCount" | "status">,
): Promise<void> {
  const db = await getDb();
  await db.put("outbox", { ...item, retryCount: 0, status: "pending" });
}

/** Return all pending items in insertion order. */
export async function getAllPending(): Promise<QueueItem[]> {
  const db = await getDb();
  return db.getAllFromIndex("outbox", "by-status", "pending");
}

/** Return all failed items. */
export async function getAllFailed(): Promise<QueueItem[]> {
  const db = await getDb();
  return db.getAllFromIndex("outbox", "by-status", "failed");
}

/** Permanently remove an item (successfully applied or user-dismissed). */
export async function deleteItem(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("outbox", id);
}

/** Increment retry count and return the new value. */
export async function incrementRetry(id: string): Promise<number> {
  const db = await getDb();
  const item = await db.get("outbox", id);
  if (!item) return 0;
  const updated: QueueItem = { ...item, retryCount: item.retryCount + 1 };
  await db.put("outbox", updated);
  return updated.retryCount;
}

/** Move an item to the "failed" bucket. */
export async function markFailed(id: string): Promise<void> {
  const db = await getDb();
  const item = await db.get("outbox", id);
  if (item) await db.put("outbox", { ...item, status: "failed" });
}

/** Count pending items. */
export async function getPendingCount(): Promise<number> {
  const db = await getDb();
  return db.countFromIndex("outbox", "by-status", "pending");
}

/** Remove all failed items. */
export async function clearAllFailed(): Promise<void> {
  const db = await getDb();
  const failed = await db.getAllFromIndex("outbox", "by-status", "failed");
  const tx = db.transaction("outbox", "readwrite");
  await Promise.all([...failed.map((item) => tx.store.delete(item.id)), tx.done]);
}
