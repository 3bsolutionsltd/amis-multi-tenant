/**
 * Registers the service worker and wires up Background Sync registration.
 *
 * Graceful degradation:
 *  - If SyncManager is unavailable the SW still installs; the online-event
 *    fallback in useSyncQueue.tsx handles flushing instead.
 *  - `GET /health` is used to confirm actual API reachability (not just
 *    navigator.onLine, which can be true even when the server is unreachable).
 */

const SW_URL = "/sw.js";

export function registerSW(): void {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register(SW_URL, {
        scope: "/",
      });

      // When the SW becomes active, try to register a Background Sync tag so
      // any queued offline mutations are flushed immediately.
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "activated") {
            tryRegisterBackgroundSync(registration);
          }
        });
      });

      // Also register sync whenever we come back online, confirmed by /health.
      window.addEventListener("online", async () => {
        const reachable = await isApiReachable();
        if (reachable) {
          tryRegisterBackgroundSync(registration);
        }
      });
    } catch (err) {
      console.error("[SW] Registration failed:", err);
    }
  });
}

async function tryRegisterBackgroundSync(
  registration: ServiceWorkerRegistration,
): Promise<void> {
  if (!("sync" in registration)) {
    // Background Sync not supported – the online-event fallback in
    // useSyncQueue.tsx will handle flushing.
    return;
  }
  try {
    await (registration as ServiceWorkerRegistration & {
      sync: { register(tag: string): Promise<void> };
    }).sync.register("outbox-flush");
  } catch (err) {
    console.warn("[SW] Background Sync registration failed:", err);
  }
}

async function isApiReachable(): Promise<boolean> {
  try {
    const res = await fetch("/health", { method: "GET", cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}
