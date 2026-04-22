import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/apiFetch";
import { Link } from "react-router-dom";
import { C } from "../lib/ui";

interface Tenant {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
  contactEmail: string | null;
  setupCompleted?: boolean;
  createdAt: string;
}

interface TenantsResponse {
  data: Tenant[];
  total: number;
}

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: `1px solid ${C.gray200}`,
  borderRadius: 10,
  padding: 24,
};

export function PlatformOverview() {
  const { data, isLoading } = useQuery<TenantsResponse>({
    queryKey: ["platform/tenants"],
    queryFn: () => apiFetch<TenantsResponse>("/tenants?limit=100"),
    staleTime: 30_000,
  });

  const tenants = data?.data ?? [];
  const active = tenants.filter((t) => t.isActive).length;
  const setupDone = tenants.filter((t) => t.setupCompleted).length;
  const pending = tenants.filter((t) => !t.setupCompleted).length;

  return (
    <div>
      <h2 style={{ marginTop: 0, marginBottom: 4, color: C.gray900, fontSize: 22 }}>
        Platform Overview
      </h2>
      <p style={{ color: C.gray500, marginBottom: 28, fontSize: 14 }}>
        Manage all VTI institutes registered on this platform.
      </p>

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: 16,
          marginBottom: 32,
        }}
      >
        {[
          { label: "Total Institutes", value: isLoading ? "…" : data?.total ?? 0, color: C.blue, bg: C.blueBg },
          { label: "Active", value: isLoading ? "…" : active, color: C.green, bg: C.greenBg },
          { label: "Setup Complete", value: isLoading ? "…" : setupDone, color: C.purple, bg: C.purpleBg },
          { label: "Setup Pending", value: isLoading ? "…" : pending, color: C.yellow, bg: C.yellowBg },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              ...cardStyle,
              background: s.bg,
              border: "none",
              padding: "20px 24px",
            }}
          >
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>
              {s.value}
            </div>
            <div style={{ fontSize: 13, color: s.color, fontWeight: 500, marginTop: 4 }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div style={{ ...cardStyle, marginBottom: 28 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15, color: C.gray700 }}>
          Quick Actions
        </h3>
        <div style={{ display: "flex", gap: 12 }}>
          <Link
            to="/platform-admin/provision"
            style={{
              background: C.purple,
              color: "#fff",
              textDecoration: "none",
              padding: "10px 20px",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            + Provision New VTI
          </Link>
          <Link
            to="/platform-admin/tenants"
            style={{
              background: C.gray100,
              color: C.gray700,
              textDecoration: "none",
              padding: "10px 20px",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              border: `1px solid ${C.gray200}`,
            }}
          >
            View All Institutes
          </Link>
        </div>
      </div>

      {/* Recent institutes */}
      <div style={cardStyle}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15, color: C.gray700 }}>
          Recent Institutes
        </h3>
        {isLoading ? (
          <p style={{ color: C.gray400 }}>Loading…</p>
        ) : tenants.length === 0 ? (
          <p style={{ color: C.gray400, fontSize: 14 }}>
            No institutes yet.{" "}
            <Link to="/platform-admin/provision" style={{ color: C.blue }}>
              Provision one
            </Link>
            .
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.gray200}` }}>
                {["Name", "Slug", "Status", "Setup", "Created"].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      padding: "6px 12px",
                      fontSize: 12,
                      fontWeight: 600,
                      color: C.gray500,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tenants.slice(0, 8).map((t) => (
                <tr key={t.id} className="amis-row-hover">
                  <td style={{ padding: "10px 12px", fontWeight: 500, color: C.gray900 }}>
                    <Link
                      to={`/platform-admin/tenants/${t.id}`}
                      style={{ color: C.blue, textDecoration: "none" }}
                    >
                      {t.name}
                    </Link>
                  </td>
                  <td style={{ padding: "10px 12px", color: C.gray500, fontFamily: "monospace", fontSize: 12 }}>
                    {t.slug}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <span
                      style={{
                        padding: "2px 10px",
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 600,
                        background: t.isActive ? C.greenBg : C.redBg,
                        color: t.isActive ? C.greenText : C.redText,
                      }}
                    >
                      {t.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <span
                      style={{
                        padding: "2px 10px",
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 600,
                        background: t.setupCompleted ? C.greenBg : C.yellowBg,
                        color: t.setupCompleted ? C.greenText : C.yellowText,
                      }}
                    >
                      {t.setupCompleted ? "Complete" : "Pending"}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px", color: C.gray500, fontSize: 12 }}>
                    {new Date(t.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
