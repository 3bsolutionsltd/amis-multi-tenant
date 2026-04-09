import { Outlet, Link, useLocation } from "react-router-dom";
import { ConfigProvider, useConfig } from "./ConfigProvider";
import { TenantSwitcher } from "./TenantSwitcher";
import { DevRoleSwitcher } from "./DevRoleSwitcher";
import { useAuth } from "../auth/AuthContext";

const FALLBACK_NAV = [{ label: "Students", route: "/students" }];

function Header() {
  const { appName } = useConfig();
  const { logout } = useAuth();
  return (
    <header
      style={{
        background: "var(--primary-color, #2563EB)",
        color: "#fff",
        padding: "12px 24px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <strong style={{ fontSize: 18 }}>{appName}</strong>
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        {import.meta.env.DEV && <TenantSwitcher />}
        {import.meta.env.DEV && <DevRoleSwitcher />}
        <button
          onClick={() => void logout()}
          style={{
            background: "rgba(255,255,255,0.15)",
            border: "1px solid rgba(255,255,255,0.4)",
            color: "#fff",
            borderRadius: 6,
            padding: "4px 12px",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Logout
        </button>
      </div>
    </header>
  );
}

function Sidebar() {
  const { navigation } = useConfig();
  const navLinks = navigation.length > 0 ? navigation : FALLBACK_NAV;
  const { pathname } = useLocation();
  return (
    <nav
      style={{
        width: 200,
        padding: "16px 0",
        borderRight: "1px solid #e5e7eb",
        minHeight: "calc(100vh - 52px)",
        background: "#f9fafb",
      }}
    >
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {navLinks.map(({ label, route }) => (
          <li key={route}>
            <Link
              to={route}
              style={{
                display: "block",
                padding: "10px 20px",
                color: pathname.startsWith(route)
                  ? "var(--primary-color, #2563EB)"
                  : "#374151",
                textDecoration: "none",
                fontWeight: pathname.startsWith(route) ? 600 : 400,
                background: pathname.startsWith(route)
                  ? "#eff6ff"
                  : "transparent",
              }}
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function DashboardCards() {
  const { dashboards } = useConfig();
  if (dashboards.length === 0) return null;
  return (
    <div
      style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}
    >
      {dashboards.map((card, i) =>
        card.type === "KPI" ? (
          <div
            key={i}
            style={{
              background: "#f3f4f6",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              padding: "16px 24px",
              minWidth: 160,
            }}
          >
            <div style={{ fontSize: 13, color: "#6b7280" }}>{card.label}</div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: "#111827",
                marginTop: 4,
              }}
            >
              —
            </div>
          </div>
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
              borderRadius: 8,
              padding: "16px 24px",
              minWidth: 160,
              textDecoration: "none",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            {card.label}
          </Link>
        ),
      )}
    </div>
  );
}

function MainContent() {
  const { pathname } = useLocation();
  return (
    <main style={{ flex: 1, padding: "24px" }}>
      {pathname === "/" && <DashboardCards />}
      <Outlet />
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
