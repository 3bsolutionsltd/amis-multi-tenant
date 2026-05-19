import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import * as q from "./offlineQueue";
import type { QueueItem } from "./offlineQueue";
import { apiFetch } from "./apiFetch";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SyncConflict {
  eventId: string;
  reason: string;
  serverValue: unknown;
}

interface FlushResult {
  applied: number;
  skipped: number;
  conflicts: SyncConflict[];
}

interface SyncQueueState {
  isOnline: boolean;
  pendingCount: number;
  failedItems: QueueItem[];
  isFlushing: boolean;
  conflicts: SyncConflict[];
  flush: () => Promise<void>;
  dismissConflict: (eventId: string) => void;
  dismissAllConflicts: () => void;
  dismissFailed: (id: string) => Promise<void>;
  dismissAllFailed: () => Promise<void>;
  refreshCounts: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const SyncQueueContext = createContext<SyncQueueState | null>(null);

export function useSyncQueue(): SyncQueueState {
  const ctx = useContext(SyncQueueContext);
  if (!ctx) throw new Error("useSyncQueue must be used inside SyncQueueProvider");
  return ctx;
}

// ---------------------------------------------------------------------------
// Helper: transform a QueueItem URL + method into a sync event
// ---------------------------------------------------------------------------

function itemToSyncEvent(item: QueueItem) {
  // Strip leading slash, split path: "/students/abc-123" → ["students", "abc-123"]
  const segments = item.url.replace(/^\//, "").split("/");
  const entityType = segments[0] ?? "unknown";
  const urlEntityId = segments[1];

  let operation: "insert" | "update" | "delete";
  let entityId: string;

  const method = item.method.toUpperCase();
  if (method === "POST") {
    operation = "insert";
    entityId = urlEntityId ?? item.id;
  } else if (method === "DELETE") {
    operation = "delete";
    entityId = urlEntityId ?? item.id;
  } else {
    operation = "update";
    entityId = urlEntityId ?? item.id;
  }

  const payload = item.body ? (JSON.parse(item.body) as Record<string, unknown>) : {};

  return {
    eventId: item.id,
    entityType,
    entityId,
    operation,
    payload,
    clientTimestamp: item.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

const MAX_RETRIES = 3;
const FLUSH_BATCH = 500;

export function SyncQueueProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [failedItems, setFailedItems] = useState<QueueItem[]>([]);
  const [isFlushing, setIsFlushing] = useState(false);
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const flushingRef = useRef(false);

  const refreshCounts = useCallback(async () => {
    const [pending, failed] = await Promise.all([
      q.getPendingCount(),
      q.getAllFailed(),
    ]);
    setPendingCount(pending);
    setFailedItems(failed);
  }, []);

  const flush = useCallback(async () => {
    if (flushingRef.current) return;
    flushingRef.current = true;
    setIsFlushing(true);

    try {
      const pending = await q.getAllPending();
      if (pending.length === 0) return;

      const tenantId = localStorage.getItem("amis_tenant_id") ?? "";

      for (let i = 0; i < pending.length; i += FLUSH_BATCH) {
        const batchItems = pending.slice(i, i + FLUSH_BATCH);
        const events = batchItems.map(itemToSyncEvent);

        try {
          const result = await apiFetch<FlushResult>("/sync/flush", {
            method: "POST",
            body: JSON.stringify({ tenantId, events }),
          });

          // Successfully flushed — remove from IDB
          for (const item of batchItems) {
            await q.deleteItem(item.id);
          }

          if (result.conflicts.length > 0) {
            setConflicts((prev) => [...prev, ...result.conflicts]);
          }
        } catch {
          // Network or server error — increment retry, mark failed after MAX_RETRIES
          for (const item of batchItems) {
            const retries = await q.incrementRetry(item.id);
            if (retries >= MAX_RETRIES) {
              await q.markFailed(item.id);
            }
          }
        }
      }
    } finally {
      flushingRef.current = false;
      setIsFlushing(false);
      await refreshCounts();
    }
  }, [refreshCounts]);

  // Wire up online/offline events
  useEffect(() => {
    void refreshCounts();

    function handleOnline() {
      setIsOnline(true);
      void flush();
    }
    function handleOffline() {
      setIsOnline(false);
      void refreshCounts();
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [flush, refreshCounts]);

  const dismissConflict = useCallback((eventId: string) => {
    setConflicts((prev) => prev.filter((c) => c.eventId !== eventId));
  }, []);

  const dismissAllConflicts = useCallback(() => setConflicts([]), []);

  const dismissFailed = useCallback(
    async (id: string) => {
      await q.deleteItem(id);
      await refreshCounts();
    },
    [refreshCounts],
  );

  const dismissAllFailed = useCallback(async () => {
    await q.clearAllFailed();
    await refreshCounts();
  }, [refreshCounts]);

  return (
    <SyncQueueContext.Provider
      value={{
        isOnline,
        pendingCount,
        failedItems,
        isFlushing,
        conflicts,
        flush,
        dismissConflict,
        dismissAllConflicts,
        dismissFailed,
        dismissAllFailed,
        refreshCounts,
      }}
    >
      {children}
    </SyncQueueContext.Provider>
  );
}
