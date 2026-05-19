import { useState, useRef, useEffect } from "react";
import { useSyncQueue, type SyncConflict } from "../lib/useSyncQueue";
import type { QueueItem } from "../lib/offlineQueue";

// ---------------------------------------------------------------------------
// Conflict toast (top-right floating)
// ---------------------------------------------------------------------------

function ConflictToast({
  conflict,
  onDismiss,
}: {
  conflict: SyncConflict;
  onDismiss: () => void;
}) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #fca5a5",
        borderLeft: "4px solid #ef4444",
        borderRadius: 8,
        padding: "10px 14px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
        maxWidth: 340,
        fontSize: 13,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 8,
        }}
      >
        <div>
          <div style={{ fontWeight: 600, color: "#991b1b", marginBottom: 2 }}>
            Sync conflict
          </div>
          <div style={{ color: "#6b7280", wordBreak: "break-word" }}>
            {conflict.reason}
          </div>
        </div>
        <button
          onClick={onDismiss}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#9ca3af",
            fontSize: 16,
            padding: 0,
            lineHeight: 1,
            flexShrink: 0,
          }}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Conflict toast container
// ---------------------------------------------------------------------------

function ConflictToastContainer() {
  const { conflicts, dismissConflict } = useSyncQueue();
  if (conflicts.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 70,
        right: 16,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        maxWidth: 360,
      }}
    >
      {conflicts.map((c) => (
        <ConflictToast
          key={c.eventId}
          conflict={c}
          onDismiss={() => dismissConflict(c.eventId)}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sync errors panel row
// ---------------------------------------------------------------------------

function FailedRow({
  item,
  onDismiss,
}: {
  item: QueueItem;
  onDismiss: () => void;
}) {
  const label = `${item.method} ${item.url}`;
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "6px 0",
        borderBottom: "1px solid #f3f4f6",
        gap: 8,
        fontSize: 12,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            color: "#374151",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </div>
        <div style={{ color: "#9ca3af", marginTop: 1 }}>
          {new Date(item.createdAt).toLocaleString()} · {item.retryCount} retries
        </div>
      </div>
      <button
        onClick={onDismiss}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "#9ca3af",
          fontSize: 15,
          padding: "0 2px",
          flexShrink: 0,
        }}
        aria-label="Dismiss failed item"
      >
        ×
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main SyncStatusBadge component
// ---------------------------------------------------------------------------

export function SyncStatusBadge() {
  const {
    isOnline,
    pendingCount,
    failedItems,
    isFlushing,
    flush,
    dismissFailed,
    dismissAllFailed,
  } = useSyncQueue();

  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const hasFailed = failedItems.length > 0;
  const showBadge = !isOnline || pendingCount > 0 || hasFailed || isFlushing;

  // Badge colour: red for failed, orange for offline/pending, blue for flushing
  const badgeColor = hasFailed
    ? "#ef4444"
    : !isOnline
      ? "#f97316"
      : isFlushing
        ? "#3b82f6"
        : "#f97316";

  // Close panel when clicking outside
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!showBadge) return <ConflictToastContainer />;

  const badgeCount = hasFailed
    ? failedItems.length
    : pendingCount > 0
      ? pendingCount
      : null;

  const icon = hasFailed ? "⚠" : !isOnline ? "📶" : isFlushing ? "↻" : "⏱";

  return (
    <>
      <ConflictToastContainer />
      <div ref={panelRef} style={{ position: "relative" }}>
        {/* Badge button */}
        <button
          onClick={() => setOpen((o) => !o)}
          title={
            hasFailed
              ? `${failedItems.length} sync error(s)`
              : !isOnline
                ? "Offline — changes will sync when reconnected"
                : isFlushing
                  ? "Syncing…"
                  : `${pendingCount} operation(s) queued`
          }
          style={{
            position: "relative",
            background: "rgba(255,255,255,0.12)",
            border: "1px solid rgba(255,255,255,0.25)",
            color: "#fff",
            borderRadius: 6,
            padding: "5px 10px",
            fontSize: 14,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span
            style={{
              display: "inline-flex",
              animation: isFlushing ? "spin 1s linear infinite" : undefined,
            }}
          >
            {icon}
          </span>

          {badgeCount !== null && (
            <span
              style={{
                background: badgeColor,
                color: "#fff",
                borderRadius: 10,
                fontSize: 10,
                fontWeight: 700,
                padding: "1px 5px",
                minWidth: 16,
                textAlign: "center",
              }}
            >
              {badgeCount}
            </span>
          )}
        </button>

        {/* Dropdown panel */}
        {open && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              right: 0,
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
              width: 320,
              zIndex: 500,
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "12px 16px",
                borderBottom: "1px solid #f3f4f6",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <strong style={{ fontSize: 13, color: "#111827" }}>
                Sync Status
              </strong>
              <span
                style={{
                  fontSize: 11,
                  color: isOnline ? "#10b981" : "#f97316",
                  fontWeight: 600,
                  background: isOnline ? "#ecfdf5" : "#fff7ed",
                  padding: "2px 8px",
                  borderRadius: 10,
                }}
              >
                {isOnline ? "Online" : "Offline"}
              </span>
            </div>

            {/* Body */}
            <div style={{ padding: "12px 16px", fontSize: 13, color: "#374151" }}>
              {/* Status line */}
              {isFlushing ? (
                <p style={{ margin: "0 0 8px", color: "#3b82f6" }}>
                  Syncing changes with server…
                </p>
              ) : !isOnline && pendingCount > 0 ? (
                <p style={{ margin: "0 0 8px" }}>
                  <strong>{pendingCount}</strong> operation
                  {pendingCount !== 1 ? "s" : ""} queued. Will sync when
                  reconnected.
                </p>
              ) : !isOnline ? (
                <p style={{ margin: "0 0 8px" }}>
                  You are offline. New changes will be queued automatically.
                </p>
              ) : pendingCount > 0 ? (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <span>
                    <strong>{pendingCount}</strong> operation
                    {pendingCount !== 1 ? "s" : ""} pending
                  </span>
                  <button
                    onClick={() => void flush()}
                    style={{
                      background: "#2563eb",
                      color: "#fff",
                      border: "none",
                      borderRadius: 6,
                      padding: "4px 10px",
                      fontSize: 12,
                      cursor: "pointer",
                      fontWeight: 500,
                    }}
                  >
                    Sync now
                  </button>
                </div>
              ) : null}

              {/* Failed items */}
              {hasFailed && (
                <div style={{ marginTop: 8 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 4,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#ef4444",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      Sync errors ({failedItems.length})
                    </span>
                    <button
                      onClick={() => void dismissAllFailed()}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#6b7280",
                        cursor: "pointer",
                        fontSize: 11,
                        padding: 0,
                        textDecoration: "underline",
                      }}
                    >
                      Dismiss all
                    </button>
                  </div>
                  <div
                    style={{
                      maxHeight: 160,
                      overflowY: "auto",
                      borderTop: "1px solid #f3f4f6",
                    }}
                  >
                    {failedItems.map((item) => (
                      <FailedRow
                        key={item.id}
                        item={item}
                        onDismiss={() => void dismissFailed(item.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {!isFlushing && !hasFailed && pendingCount === 0 && (
                <p style={{ margin: 0, color: "#6b7280", fontSize: 12 }}>
                  All changes synced.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
