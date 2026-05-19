import { useEffect, useRef } from "react";
import type { ConflictMessage } from "../lib/conflictMessages";

interface SyncConflictToastProps {
  message: ConflictMessage;
  onDismiss: () => void;
  /** Auto-dismiss after this many milliseconds. Defaults to 6000. */
  autoDismissMs?: number;
}

const SEVERITY_STYLES: Record<
  ConflictMessage["severity"],
  { background: string; border: string; titleColor: string }
> = {
  warning: {
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    titleColor: "#c2410c",
  },
  success: {
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    titleColor: "#15803d",
  },
  info: {
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    titleColor: "#1d4ed8",
  },
};

/**
 * Inline-styled toast that displays a single sync conflict message.
 *
 * Rendered by SyncConflictToastStack. Auto-dismisses after `autoDismissMs`.
 */
export function SyncConflictToast({
  message,
  onDismiss,
  autoDismissMs = 6000,
}: SyncConflictToastProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(onDismiss, autoDismissMs);
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, [onDismiss, autoDismissMs]);

  const styles = SEVERITY_STYLES[message.severity];

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "10px 14px",
        borderRadius: 8,
        background: styles.background,
        border: styles.border,
        boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
        minWidth: 280,
        maxWidth: 400,
        pointerEvents: "auto",
      }}
    >
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: 13,
            color: styles.titleColor,
            marginBottom: 2,
          }}
        >
          {message.title}
        </div>
        <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.4 }}>
          {message.detail}
        </div>
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss notification"
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "#9ca3af",
          fontSize: 16,
          lineHeight: 1,
          padding: 0,
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------

interface ToastItem {
  id: string;
  message: ConflictMessage;
}

interface SyncConflictToastStackProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

/**
 * Fixed-position stack that renders multiple SyncConflictToast items.
 *
 * Mount this once near the app root and feed it from a toast state manager.
 *
 * @example
 * ```tsx
 * const [toasts, setToasts] = useState<ToastItem[]>([]);
 *
 * function pushConflicts(conflicts, eventIndex) {
 *   const messages = getConflictMessages(conflicts, eventIndex);
 *   setToasts(prev => [
 *     ...prev,
 *     ...messages.map(m => ({ id: crypto.randomUUID(), message: m })),
 *   ]);
 * }
 *
 * <SyncConflictToastStack
 *   toasts={toasts}
 *   onDismiss={id => setToasts(prev => prev.filter(t => t.id !== id))}
 * />
 * ```
 */
export function SyncConflictToastStack({
  toasts,
  onDismiss,
}: SyncConflictToastStackProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-label="Sync notifications"
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        pointerEvents: "none",
      }}
    >
      {toasts.map((t) => (
        <SyncConflictToast
          key={t.id}
          message={t.message}
          onDismiss={() => onDismiss(t.id)}
        />
      ))}
    </div>
  );
}
