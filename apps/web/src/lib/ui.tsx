/**
 * AMIS shared UI primitives.
 * All styling is inline — no Tailwind, no CSS modules.
 */
import { type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";

// ---------------------------------------------------------------------------
// Animation helpers (injected once into <head>)
// ---------------------------------------------------------------------------
let _cssInjected = false;
export function ensureGlobalCss() {
  if (_cssInjected || typeof document === "undefined") return;
  _cssInjected = true;
  const el = document.createElement("style");
  el.textContent = `
    @keyframes amis-spin   { to { transform: rotate(360deg); } }
    @keyframes amis-pulse  { 0%,100%{opacity:1} 50%{opacity:.4} }
    @keyframes amis-fadein { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
    .amis-row-hover:hover  { background: #f8fafc !important; }
  `;
  document.head.appendChild(el);
}

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------
export const C = {
  primary: "var(--primary-color, #2563EB)",
  white: "#ffffff",
  gray50: "#f9fafb",
  gray100: "#f3f4f6",
  gray200: "#e5e7eb",
  gray300: "#d1d5db",
  gray400: "#9ca3af",
  gray500: "#6b7280",
  gray700: "#374151",
  gray900: "#111827",
  red: "#dc2626",
  redBg: "#fee2e2",
  redText: "#b91c1c",
  green: "#16a34a",
  greenBg: "#dcfce7",
  greenText: "#15803d",
  yellow: "#d97706",
  yellowBg: "#fef9c3",
  yellowText: "#92400e",
  blue: "#2563eb",
  blueBg: "#dbeafe",
  blueText: "#1d4ed8",
  purple: "#7c3aed",
  purpleBg: "#ede9fe",
  purpleText: "#6d28d9",
  cyan: "#0891b2",
  cyanBg: "#cffafe",
  cyanText: "#0e7490",
  pink: "#db2777",
  pinkBg: "#fce7f3",
  pinkText: "#be185d",
  indigo: "#4f46e5",
  indigoBg: "#e0e7ff",
  indigoText: "#3730a3",
} as const;

// ---------------------------------------------------------------------------
// Spinner
// ---------------------------------------------------------------------------
export function Spinner({ size = 32 }: { size?: number }) {
  ensureGlobalCss();
  return (
    <div
      style={{ display: "flex", justifyContent: "center", padding: "56px 0" }}
    >
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          border: `3px solid ${C.gray200}`,
          borderTopColor: C.primary,
          animation: "amis-spin 0.65s linear infinite",
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton table rows
// ---------------------------------------------------------------------------
export function SkeletonRows({
  cols,
  rows = 6,
}: {
  cols: number;
  rows?: number;
}) {
  ensureGlobalCss();
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} style={{ padding: "14px 16px" }}>
              <div
                style={{
                  height: 14,
                  borderRadius: 4,
                  background: C.gray100,
                  width: c === cols - 1 ? "50%" : "85%",
                  animation: "amis-pulse 1.5s ease-in-out infinite",
                  animationDelay: `${r * 0.06}s`,
                }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Error banner
// ---------------------------------------------------------------------------
export function ErrorBanner({
  message = "Something went wrong. Please try again.",
}: {
  message?: string;
}) {
  return (
    <div
      style={{
        background: C.redBg,
        border: `1px solid #fca5a5`,
        borderRadius: 8,
        padding: "14px 18px",
        color: C.redText,
        fontSize: 14,
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <span style={{ fontSize: 18 }}>⚠️</span>
      {message}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------
export function EmptyState({
  icon = "📋",
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div style={{ textAlign: "center", padding: "64px 24px" }}>
      <div style={{ fontSize: 44, marginBottom: 14, opacity: 0.35 }}>
        {icon}
      </div>
      <div
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: C.gray700,
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      {description && (
        <div
          style={{
            fontSize: 14,
            color: C.gray500,
            maxWidth: 320,
            margin: "0 auto 20px",
          }}
        >
          {description}
        </div>
      )}
      {action}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------
export function Card({
  children,
  style,
  padding = "0",
}: {
  children: ReactNode;
  style?: CSSProperties;
  padding?: string | number;
}) {
  return (
    <div
      style={{
        background: C.white,
        border: `1px solid ${C.gray200}`,
        borderRadius: 10,
        boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
        overflow: "hidden",
        padding,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page header
// ---------------------------------------------------------------------------
export function PageHeader({
  title,
  description,
  back,
  action,
}: {
  title: string;
  description?: string;
  back?: { label: string; to: string };
  action?: ReactNode;
}) {
  ensureGlobalCss();
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 24,
        animation: "amis-fadein 0.18s ease-out",
      }}
    >
      <div>
        {back && (
          <Link
            to={back.to}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 13,
              color: C.gray500,
              textDecoration: "none",
              marginBottom: 8,
              fontWeight: 500,
            }}
          >
            ← {back.label}
          </Link>
        )}
        <h1
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 700,
            color: C.gray900,
            lineHeight: 1.2,
          }}
        >
          {title}
        </h1>
        {description && (
          <p style={{ margin: "5px 0 0", fontSize: 14, color: C.gray500 }}>
            {description}
          </p>
        )}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------
const BTN_BASE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  borderRadius: 7,
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  border: "none",
  whiteSpace: "nowrap",
  transition: "opacity 0.15s",
};

export function PrimaryBtn({
  children,
  onClick,
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        ...BTN_BASE,
        background: C.primary,
        color: C.white,
        padding: "9px 18px",
        opacity: disabled ? 0.55 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

export function SecondaryBtn({
  children,
  onClick,
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        ...BTN_BASE,
        background: C.white,
        color: C.gray700,
        padding: "8px 16px",
        border: `1px solid ${C.gray300}`,
        opacity: disabled ? 0.55 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

export function DangerBtn({
  children,
  onClick,
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        ...BTN_BASE,
        background: C.redBg,
        color: C.redText,
        padding: "7px 14px",
        border: `1px solid #fca5a5`,
        opacity: disabled ? 0.55 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: 13,
      }}
    >
      {children}
    </button>
  );
}

export function SuccessBtn({
  children,
  onClick,
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        ...BTN_BASE,
        background: C.greenBg,
        color: C.greenText,
        padding: "7px 14px",
        border: `1px solid #86efac`,
        opacity: disabled ? 0.55 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: 13,
      }}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------
type BadgeColor =
  | "gray"
  | "blue"
  | "green"
  | "yellow"
  | "red"
  | "purple"
  | "cyan"
  | "pink"
  | "indigo";

const BADGE_MAP: Record<BadgeColor, { bg: string; color: string }> = {
  gray: { bg: C.gray100, color: C.gray700 },
  blue: { bg: C.blueBg, color: C.blueText },
  green: { bg: C.greenBg, color: C.greenText },
  yellow: { bg: C.yellowBg, color: C.yellowText },
  red: { bg: C.redBg, color: C.redText },
  purple: { bg: C.purpleBg, color: C.purpleText },
  cyan: { bg: C.cyanBg, color: C.cyanText },
  pink: { bg: C.pinkBg, color: C.pinkText },
  indigo: { bg: C.indigoBg, color: C.indigoText },
};

export function Badge({
  label,
  color = "gray",
}: {
  label: string;
  color?: BadgeColor;
}) {
  const { bg, color: fg } = BADGE_MAP[color];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 600,
        background: bg,
        color: fg,
        whiteSpace: "nowrap",
        letterSpacing: "0.01em",
      }}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Data table
// ---------------------------------------------------------------------------
export function DataTable({
  headers,
  isLoading,
  isEmpty,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  emptyAction,
  children,
  colCount,
}: {
  headers: string[];
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyIcon?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  children?: ReactNode;
  colCount?: number;
}) {
  const cols = colCount ?? headers.length;
  return (
    <Card>
      <div style={{ overflowX: "auto" }}>
        <table
          style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}
        >
          <thead>
            <tr
              style={{
                background: C.gray50,
                borderBottom: `1px solid ${C.gray200}`,
              }}
            >
              {headers.map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: "left",
                    padding: "11px 16px",
                    fontSize: 11,
                    fontWeight: 700,
                    color: C.gray500,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && <SkeletonRows cols={cols} />}
            {!isLoading && isEmpty && (
              <tr>
                <td colSpan={cols}>
                  <EmptyState
                    icon={emptyIcon}
                    title={emptyTitle ?? "No records found"}
                    description={emptyDescription}
                    action={emptyAction}
                  />
                </td>
              </tr>
            )}
            {!isLoading && !isEmpty && children}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// Row used inside DataTable
export function TR({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  ensureGlobalCss();
  return (
    <tr
      className={onClick ? "amis-row-hover" : undefined}
      onClick={onClick}
      style={{
        borderBottom: `1px solid ${C.gray100}`,
        cursor: onClick ? "pointer" : "default",
        background: C.white,
      }}
    >
      {children}
    </tr>
  );
}

export function TD({
  children,
  muted,
  style,
}: {
  children: ReactNode;
  muted?: boolean;
  style?: CSSProperties;
}) {
  return (
    <td
      style={{
        padding: "12px 16px",
        color: muted ? C.gray500 : C.gray700,
        fontSize: muted ? 13 : 14,
        ...style,
      }}
    >
      {children}
    </td>
  );
}

// ---------------------------------------------------------------------------
// Filter bar
// ---------------------------------------------------------------------------
export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
        alignItems: "center",
        marginBottom: 16,
        padding: "12px 16px",
        background: C.white,
        border: `1px solid ${C.gray200}`,
        borderRadius: 8,
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
      }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Form input + label wrapper
// ---------------------------------------------------------------------------
export function Field({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: C.gray700,
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        {label}
        {required && <span style={{ color: C.red, fontSize: 12 }}>*</span>}
      </label>
      {children}
      {error && (
        <span style={{ color: C.red, fontSize: 12, marginTop: 2 }}>
          {error}
        </span>
      )}
    </div>
  );
}

export const inputCss: CSSProperties = {
  padding: "9px 12px",
  border: `1px solid ${C.gray300}`,
  borderRadius: 6,
  fontSize: 14,
  width: "100%",
  boxSizing: "border-box",
  color: C.gray900,
  background: C.white,
  outline: "none",
};

export const selectCss: CSSProperties = {
  ...inputCss,
  cursor: "pointer",
};

// ---------------------------------------------------------------------------
// Inline search input (for filter bars)
// ---------------------------------------------------------------------------
export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  width = 260,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  width?: number;
}) {
  return (
    <div style={{ position: "relative", width }}>
      <span
        style={{
          position: "absolute",
          left: 10,
          top: "50%",
          transform: "translateY(-50%)",
          fontSize: 15,
          color: C.gray400,
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        🔍
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          ...inputCss,
          paddingLeft: 34,
          width: "100%",
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------
export function Pagination({
  page,
  hasMore,
  onPrev,
  onNext,
}: {
  page: number;
  hasMore: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  const btnStyle = (disabled: boolean): CSSProperties => ({
    padding: "7px 16px",
    border: `1px solid ${C.gray300}`,
    borderRadius: 6,
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 13,
    fontWeight: 500,
    background: C.white,
    color: disabled ? C.gray400 : C.gray700,
    opacity: disabled ? 0.6 : 1,
  });
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 8,
        marginTop: 16,
        paddingTop: 12,
        borderTop: `1px solid ${C.gray100}`,
      }}
    >
      <button
        onClick={onPrev}
        disabled={page === 1}
        style={btnStyle(page === 1)}
      >
        ← Previous
      </button>
      <span
        style={{
          fontSize: 13,
          color: C.gray500,
          minWidth: 64,
          textAlign: "center",
        }}
      >
        Page {page}
      </span>
      <button onClick={onNext} disabled={!hasMore} style={btnStyle(!hasMore)}>
        Next →
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat card (for dashboard/finance)
// ---------------------------------------------------------------------------
export function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: ReactNode;
  accent?: string;
}) {
  return (
    <div
      style={{
        background: C.white,
        border: `1px solid ${C.gray200}`,
        borderRadius: 10,
        padding: "18px 22px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        flex: "1 1 160px",
        minWidth: 150,
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: C.gray500,
          fontWeight: 600,
          marginBottom: 6,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </div>
      <div
        style={{ fontSize: 22, fontWeight: 700, color: accent ?? C.gray900 }}
      >
        {value}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal overlay
// ---------------------------------------------------------------------------
export function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        backdropFilter: "blur(2px)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: C.white,
          borderRadius: 12,
          padding: "28px 32px",
          minWidth: 360,
          maxWidth: 520,
          width: "90%",
          boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
          animation: "amis-fadein 0.15s ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: 17,
              fontWeight: 700,
              color: C.gray900,
            }}
          >
            {title}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: 20,
              cursor: "pointer",
              color: C.gray400,
              lineHeight: 1,
              padding: "0 4px",
            }}
          >
            ×
          </button>
        </div>
        {children}
        {footer && (
          <div
            style={{
              marginTop: 24,
              display: "flex",
              gap: 10,
              justifyContent: "flex-end",
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section divider with label
// ---------------------------------------------------------------------------
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: C.gray400,
        textTransform: "uppercase",
        letterSpacing: "0.07em",
        marginBottom: 12,
        marginTop: 4,
      }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail row (label + value pair in a card)
// ---------------------------------------------------------------------------
export function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "180px 1fr",
        padding: "10px 0",
        borderBottom: `1px solid ${C.gray100}`,
        fontSize: 14,
        alignItems: "start",
      }}
    >
      <span style={{ color: C.gray500, fontWeight: 500 }}>{label}</span>
      <span style={{ color: C.gray900 }}>{children}</span>
    </div>
  );
}
