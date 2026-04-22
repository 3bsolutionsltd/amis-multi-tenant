import { useEffect } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const NAV_BASE: React.CSSProperties = {
  display: "block",
  padding: "10px 20px",
  textDecoration: "none",
  fontSize: 14,
  fontWeight: 500,
  borderLeft: "3px solid transparent",
};

const SECTION_LABEL: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: 1,
  padding: "16px 20px 6px",
};

function navStyle({ isActive }: { isActive: boolean }): React.CSSProperties {
  return {
    ...NAV_BASE,
    color: isActive ? "#fff" : "#94a3b8",
    background: isActive ? "#7c3aed" : "transparent",
    borderLeftColor: isActive ? "#c4b5fd" : "transparent",
  };
}

export function PlatformAdminLayout() {
  const { user } = useAuth();
  const role = user?.role ?? "none";
  const navigate = useNavigate();

  useEffect(() => {
    if (role !== "platform_admin") {
      navigate("/", { replace: true });
    }
  }, [role, navigate]);

  if (role !== "platform_admin") return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <header
        style={{
          background: "#1e0a3c",
          color: "#fff",
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          gap: 24,
          borderBottom: "1px solid #2d1559",
        }}
      >
        <Link
          to="/"
          style={{ color: "#a78bfa", textDecoration: "none", fontSize: 13 }}
        >
          ← App
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>🏛️</span>
          <strong style={{ fontSize: 17, letterSpacing: 0.5 }}>
            Platform Admin
          </strong>
        </div>
        <div
          style={{
            marginLeft: "auto",
            fontSize: 12,
            color: "#a78bfa",
            background: "rgba(124,58,237,0.2)",
            padding: "3px 10px",
            borderRadius: 20,
          }}
        >
          PLATFORM ADMIN
        </div>
      </header>

      <div style={{ display: "flex", flex: 1 }}>
        <nav
          style={{
            width: 220,
            background: "#1e0a3c",
            paddingTop: 8,
            flexShrink: 0,
          }}
        >
          <NavLink to="/platform-admin" end style={navStyle}>
            Overview
          </NavLink>

          <div style={SECTION_LABEL}>Institutes</div>
          <NavLink to="/platform-admin/tenants" style={navStyle}>
            All Institutes (VTIs)
          </NavLink>
          <NavLink to="/platform-admin/provision" style={navStyle}>
            Provision New VTI
          </NavLink>

          <div style={SECTION_LABEL}>Platform</div>
          <NavLink to="/platform-admin/users" style={navStyle}>
            Platform Users
          </NavLink>
        </nav>

        <main
          style={{
            flex: 1,
            padding: 32,
            background: "#f8fafc",
            overflowY: "auto",
          }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
