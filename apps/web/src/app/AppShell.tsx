import { Component, type ErrorInfo, type ReactNode } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { ConfigProvider, useConfig } from "./ConfigProvider";
import { TenantSwitcher } from "./TenantSwitcher";
import { DevRoleSwitcher } from "./DevRoleSwitcher";
import { useAuth } from "../auth/AuthContext";
import { C, StatCard, ensureGlobalCss } from "../lib/ui";

ensureGlobalCss();

// ---------------------------------------------------------------------------
// Error Boundary
// ---------------------------------------------------------------------------
interface EBState {
  hasError: boolean;
  message: string;
}
class ErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  state: EBState = { hasError: false, message: "" };
  static getDerivedStateFromError(err: unknown): EBState {
    return {
      hasError: true,
      message: err instanceof Error ? err.message : String(err),
    };
  }
  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", err, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            margin: "40px auto",
            maxWidth: 520,
            background: "#fff",
            border: "1px solid #fca5a5",
            borderRadius: 10,
            padding: "32px 36px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 16 }}>💥</div>
          <h2 style={{ margin: "0 0 8px", color: "#991b1b", fontSize: 18 }}>
            Something went wrong
          </h2>
          <p
            style={{
              color: "#6b7280",
              fontSize: 14,
              margin: "0 0 24px",
              wordBreak: "break-word",
            }}
          >
            {this.state.message || "An unexpected error occurred."}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, message: "" })}
            style={{
              background: "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "8px 20px",
              fontSize: 14,
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            Try again
          </button>
          <a
            href="/"
            style={{
              display: "inline-block",
              marginLeft: 12,
              color: "#2563eb",
              fontSize: 14,
              fontWeight: 500,
              textDecoration: "underline",
            }}
          >
            Go Home
          </a>
        </div>
      );
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Nav
// ---------------------------------------------------------------------------

const FALLBACK_NAV = [
  { label: "Dashboard", route: "/" },
  { label: "Students", route: "/students" },
  { label: "Admissions", route: "/admissions" },
  { label: "Programmes", route: "/programmes" },
  { label: "Term Registrations", route: "/term-registrations" },
  { label: "Bulk Registration", route: "/term-registrations/bulk" },
  { label: "Marks", route: "/marks" },
  { label: "Finance", route: "/finance" },
  { label: "Clearance", route: "/clearance" },
  { label: "Results", route: "/results" },
  { label: "Industrial Training", route: "/industrial-training" },
  { label: "Field Placements", route: "/field-placements" },
  { label: "Analytics", route: "/analytics" },
  { label: "Staff", route: "/staff" },
  { label: "Reports", route: "/reports/it" },
  { label: "Marks Analysis", route: "/reports/marks-analysis" },
  { label: "Timetable", route: "/timetable" },
  { label: "Attendance", route: "/attendance" },
  { label: "Users", route: "/users" },
];

const NAV_ICONS: Record<string, string> = {
  "/": "🏠",
  "/students": "👨‍🎓",
  "/admissions": "📋",
  "/programmes": "🎓",
  "/term-registrations": "📅",
  "/term-registrations/bulk": "📦",
  "/marks": "📊",
  "/finance": "💰",
  "/clearance": "🔐",
  "/results": "📄",
  "/industrial-training": "🏗️",
  "/field-placements": "📍",
  "/analytics": "📈",
  "/users": "👥",
  "/staff": "👔",
  "/reports/it": "📋",
  "/reports/marks-analysis": "📊",
  "/timetable": "🗓️",
  "/attendance": "✅",
};

function Header() {
  const { appName } = useConfig();
  const { user, logout } = useAuth();
  return (
    <header
      style={{
        background: "var(--primary-color, #2563EB)",
        color: "#fff",
        padding: "0 24px",
        height: 56,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: "rgba(255,255,255,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
          }}
        >
          🎓
        </div>
        <strong style={{ fontSize: 17, letterSpacing: "-0.01em" }}>
          {appName}
        </strong>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        {import.meta.env.DEV && <TenantSwitcher />}
        {import.meta.env.DEV && <DevRoleSwitcher />}

        {user && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "4px 12px",
              background: "rgba(255,255,255,0.12)",
              borderRadius: 20,
              fontSize: 13,
            }}
          >
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {user.email[0].toUpperCase()}
            </div>
            <span style={{ opacity: 0.9 }}>{user.email.split("@")[0]}</span>
            <span
              style={{
                fontSize: 11,
                background: "rgba(255,255,255,0.2)",
                padding: "1px 7px",
                borderRadius: 10,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              {user.role}
            </span>
          </div>
        )}

        <button
          onClick={() => void logout()}
          style={{
            background: "rgba(255,255,255,0.12)",
            border: "1px solid rgba(255,255,255,0.25)",
            color: "#fff",
            borderRadius: 6,
            padding: "5px 14px",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          ↩ Sign out
        </button>
      </div>
    </header>
  );
}

function Sidebar() {
  const { navigation } = useConfig();
  const navLinks = navigation.length > 0 ? navigation : FALLBACK_NAV;
  const { pathname } = useLocation();
  const { user } = useAuth();

  return (
    <aside
      style={{
        width: 220,
        minHeight: "calc(100vh - 56px)",
        background: C.white,
        borderRight: `1px solid ${C.gray200}`,
        display: "flex",
        flexDirection: "column",
        padding: "12px 0",
        flexShrink: 0,
      }}
    >
      <nav>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {navLinks.map(({ label, route }) => {
            const active =
              route === "/"
                ? pathname === "/"
                : pathname === route ||
                  pathname.startsWith(route);
            const icon = NAV_ICONS[route] ?? "•";
            return (
              <li key={route}>
                <Link
                  to={route}
                  className={active ? undefined : "amis-nav-link"}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 16px 9px 20px",
                    margin: "1px 8px",
                    borderRadius: 7,
                    color: active ? "var(--primary-color, #2563EB)" : C.gray700,
                    textDecoration: "none",
                    fontWeight: active ? 600 : 400,
                    background: active
                      ? "var(--primary-color-bg, #eff6ff)"
                      : "transparent",
                    fontSize: 14,
                    transition: "background 0.12s",
                    borderLeft: active
                      ? "3px solid var(--primary-color, #2563EB)"
                      : "3px solid transparent",
                  }}
                >
                  <span
                    style={{ fontSize: 16, minWidth: 20, textAlign: "center" }}
                  >
                    {icon}
                  </span>
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div
        style={{
          marginTop: "auto",
          padding: "12px 20px",
          borderTop: `1px solid ${C.gray100}`,
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: C.gray400,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: 4,
          }}
        >
          System
        </div>
        <Link
          to="/admin-studio"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
            color: C.gray500,
            textDecoration: "none",
            padding: "6px 0",
          }}
        >
          <span>⚙️</span> Admin Studio
        </Link>
        {user?.role === "platform_admin" && (
          <Link
            to="/platform-admin"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              color: "#7c3aed",
              textDecoration: "none",
              padding: "6px 0",
              fontWeight: 600,
            }}
          >
            <span>🏛️</span> Platform Admin
          </Link>
        )}
      </div>
    </aside>
  );
}

function DashboardCards() {
  const { dashboards } = useConfig();
  if (dashboards.length === 0) return null;
  return (
    <div
      style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 28 }}
    >
      {dashboards.map((card, i) =>
        card.type === "KPI" ? (
          <StatCard key={i} label={card.label} value="—" />
        ) : (
          <Link
            key={i}
            to={card.route ?? "/"}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--primary-color, #2563EB)",
              color: "#fff",
              borderRadius: 10,
              padding: "18px 28px",
              minWidth: 160,
              textDecoration: "none",
              fontWeight: 600,
              fontSize: 14,
              boxShadow: "0 2px 8px rgba(37,99,235,0.25)",
            }}
          >
            {card.label} →
          </Link>
        ),
      )}
    </div>
  );
}

function MainContent() {
  const { pathname } = useLocation();
  return (
    <main
      style={{
        flex: 1,
        padding: "28px 32px",
        background: "#f3f4f6",
        minHeight: "calc(100vh - 56px)",
        animation: "amis-fadein 0.18s ease-out",
      }}
    >
      {pathname === "/" && <DashboardCards />}
      <ErrorBoundary key={pathname}>
        <Outlet />
      </ErrorBoundary>
    </main>
  );
}

function Shell() {
  return (
    <ConfigProvider>
      <Header />
      <div style={{ display: "flex" }}>
        <Sidebar />
        <MainContent />
      </div>
    </ConfigProvider>
  );
}

export function AppShell() {
  return <Shell />;
}
