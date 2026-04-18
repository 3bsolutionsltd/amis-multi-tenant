import { useEffect } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const NAV_STYLE_BASE: React.CSSProperties = {
  display: "block",
  padding: "10px 20px",
  textDecoration: "none",
  fontSize: 14,
  fontWeight: 500,
  borderLeft: "3px solid transparent",
};

const NAV_SECTION: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: 1,
  padding: "16px 20px 6px",
};

function studioNavStyle({
  isActive,
}: {
  isActive: boolean;
}): React.CSSProperties {
  return {
    ...NAV_STYLE_BASE,
    color: isActive ? "#fff" : "#94a3b8",
    background: isActive ? "#1e3a5f" : "transparent",
    borderLeftColor: isActive ? "#60a5fa" : "transparent",
  };
}

export function AdminStudioLayout() {
  const { user } = useAuth();
  const role = user?.role ?? "none";
  const navigate = useNavigate();

  useEffect(() => {
    if (role !== "admin") {
      navigate("/", { replace: true });
    }
  }, [role, navigate]);

  if (role !== "admin") return null;

  return (
    <div
      style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}
    >
      <header
        style={{
          background: "#0f172a",
          color: "#fff",
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          gap: 24,
          borderBottom: "1px solid #1e293b",
        }}
      >
        <Link
          to="/"
          style={{ color: "#64748b", textDecoration: "none", fontSize: 13 }}
        >
          ← App
        </Link>
        <strong style={{ fontSize: 17, letterSpacing: 0.5 }}>
          Admin Studio
        </strong>
      </header>

      <div style={{ display: "flex", flex: 1 }}>
        <nav
          style={{
            width: 210,
            background: "#0f172a",
            paddingTop: 8,
            flexShrink: 0,
          }}
        >
          <NavLink to="/admin-studio" end style={studioNavStyle}>
            Overview
          </NavLink>

          <div style={NAV_SECTION}>Platform</div>
          <NavLink to="/admin-studio/tenants" style={studioNavStyle}>
            Tenants
          </NavLink>

          <div style={NAV_SECTION}>Configuration</div>
          <NavLink to="/admin-studio/editor" style={studioNavStyle}>
            Config Editor
          </NavLink>
          <NavLink to="/admin-studio/branding" style={studioNavStyle}>
            Branding &amp; Theme
          </NavLink>
          <NavLink to="/admin-studio/modules" style={studioNavStyle}>
            Module Toggles
          </NavLink>
          <NavLink to="/admin-studio/navigation" style={studioNavStyle}>
            Navigation
          </NavLink>
          <NavLink to="/admin-studio/workflows" style={studioNavStyle}>
            Workflows-studio/branding" style={studioNavStyle}>
            Branding &amp; Theme
          </NavLink>
          <NavLink to="/admin-studio/modules" style={studioNavStyle}>
            Module Toggles
          </NavLink>
          <NavLink to="/admin-studio/navigation" style={studioNavStyle}>
            Navigation
          </NavLink>
          <NavLink to="/admin-studio/workflows" style={studioNavStyle}>
            Workflows
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
