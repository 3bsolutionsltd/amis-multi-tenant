import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/apiFetch";
import { C } from "../lib/ui";

interface PlatformUser {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export function PlatformUsersPage() {
  const { data, isLoading, isError } = useQuery<PlatformUser[]>({
    queryKey: ["platform/users"],
    queryFn: () => apiFetch<PlatformUser[]>("/platform/users"),
    staleTime: 30_000,
  });

  return (
    <div>
      <h2 style={{ marginTop: 0, marginBottom: 4, color: C.gray900, fontSize: 22 }}>
        Platform Users
      </h2>
      <p style={{ color: C.gray500, marginBottom: 28, fontSize: 14 }}>
        Users with platform-level admin access.
      </p>

      <div
        style={{
          background: "#fff",
          border: `1px solid ${C.gray200}`,
          borderRadius: 10,
          overflow: "hidden",
        }}
      >
        {isLoading && (
          <div style={{ padding: 32, textAlign: "center", color: C.gray500, fontSize: 14 }}>
            Loading…
          </div>
        )}
        {isError && (
          <div style={{ padding: 32, textAlign: "center", color: C.red, fontSize: 14 }}>
            Failed to load platform users.
          </div>
        )}
        {!isLoading && !isError && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: C.gray50, borderBottom: `1px solid ${C.gray200}` }}>
                <th style={th}>Email</th>
                <th style={th}>Role</th>
                <th style={th}>Status</th>
                <th style={th}>Created</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    style={{ padding: 24, textAlign: "center", color: C.gray500 }}
                  >
                    No platform admin users found.
                  </td>
                </tr>
              ) : (
                (data ?? []).map((u) => (
                  <tr
                    key={u.id}
                    className="amis-row-hover"
                    style={{ borderBottom: `1px solid ${C.gray100}` }}
                  >
                    <td style={td}>{u.email}</td>
                    <td style={td}>
                      <span
                        style={{
                          background: C.purpleBg,
                          color: C.purpleText,
                          padding: "2px 8px",
                          borderRadius: 12,
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td style={td}>
                      <span
                        style={{
                          background: u.is_active ? C.greenBg : C.redBg,
                          color: u.is_active ? C.greenText : C.redText,
                          padding: "2px 8px",
                          borderRadius: 12,
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        {u.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td style={{ ...td, color: C.gray500 }}>
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  padding: "10px 16px",
  textAlign: "left",
  fontWeight: 600,
  fontSize: 12,
  color: C.gray500,
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

const td: React.CSSProperties = {
  padding: "12px 16px",
  color: C.gray900,
};
