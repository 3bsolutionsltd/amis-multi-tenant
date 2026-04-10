import { useQueries } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { listStudents } from "../students/students.api";
import { listApplications } from "../admissions/admissions.api";
import { listTermRegistrations } from "../term-registrations/term-registrations.api";
import { listSubmissions } from "../marks/marks.api";
import { useAuth } from "../../auth/AuthContext";
import {
  ensureGlobalCss,
  C,
  Card,
  Badge,
  PrimaryBtn,
  SecondaryBtn,
} from "../../lib/ui";

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, cap = 100): string {
  return n >= cap ? `${cap}+` : String(n);
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── WelcomeBanner ─────────────────────────────────────────────────────────────

function WelcomeBanner({
  email,
  role,
}: {
  email: string;
  role: string;
}) {
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const name = email.split("@")[0];

  return (
    <div
      style={{
        background: `linear-gradient(135deg, #1e40af 0%, #3b82f6 60%, #0ea5e9 100%)`,
        borderRadius: 14,
        padding: "32px 36px",
        color: "#fff",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 28,
        boxShadow: "0 4px 20px rgba(37,99,235,0.3)",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* decorative circles */}
      <div
        style={{
          position: "absolute",
          top: -40,
          right: -40,
          width: 200,
          height: 200,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.07)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -60,
          right: 120,
          width: 150,
          height: 150,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.05)",
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ fontSize: 14, opacity: 0.8, marginBottom: 4 }}>
          {greeting},
        </div>
        <div
          style={{
            fontSize: 26,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            marginBottom: 8,
            textTransform: "capitalize",
          }}
        >
          {name}
        </div>
        <div
          style={{
            fontSize: 13,
            opacity: 0.75,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            style={{
              background: "rgba(255,255,255,0.2)",
              padding: "2px 10px",
              borderRadius: 20,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              fontSize: 11,
            }}
          >
            {role}
          </span>
          <span>Academic Management System</span>
        </div>
      </div>

      <div
        style={{
          position: "relative",
          zIndex: 1,
          fontSize: 56,
          opacity: 0.9,
        }}
      >
        🎓
      </div>
    </div>
  );
}

// ── StatCard ──────────────────────────────────────────────────────────────────

function StatTile({
  icon,
  label,
  value,
  sub,
  accentColor,
  loading,
  onClick,
}: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  accentColor: string;
  loading?: boolean;
  onClick?: () => void;
}) {
  ensureGlobalCss();
  return (
    <div
      onClick={onClick}
      style={{
        background: C.white,
        border: `1px solid ${C.gray200}`,
        borderRadius: 12,
        padding: "20px 22px",
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        cursor: onClick ? "pointer" : "default",
        transition: "box-shadow 0.18s, transform 0.18s",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          (e.currentTarget as HTMLDivElement).style.boxShadow =
            "0 4px 16px rgba(0,0,0,0.12)";
          (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow =
          "0 1px 4px rgba(0,0,0,0.06)";
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
      }}
    >
      {/* color bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: accentColor,
          borderRadius: "12px 12px 0 0",
        }}
      />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: C.gray400,
              textTransform: "uppercase",
              letterSpacing: "0.07em",
              marginBottom: 6,
            }}
          >
            {label}
          </div>
          {loading ? (
            <div
              style={{
                height: 28,
                width: 64,
                borderRadius: 6,
                background: C.gray100,
                animation: "amis-pulse 1.5s ease-in-out infinite",
              }}
            />
          ) : (
            <div
              style={{
                fontSize: 30,
                fontWeight: 800,
                color: accentColor,
                letterSpacing: "-0.02em",
                lineHeight: 1,
              }}
            >
              {value}
            </div>
          )}
          {sub && !loading && (
            <div style={{ fontSize: 12, color: C.gray400, marginTop: 4 }}>
              {sub}
            </div>
          )}
        </div>
        <div
          style={{
            fontSize: 28,
            opacity: 0.15,
          }}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

// ── RecentList ────────────────────────────────────────────────────────────────

function RecentList({
  title,
  icon,
  items,
  loading,
  onViewAll,
  renderItem,
}: {
  title: string;
  icon: string;
  items: unknown[];
  loading: boolean;
  onViewAll: () => void;
  renderItem: (item: unknown, i: number) => React.ReactNode;
}) {
  ensureGlobalCss();
  return (
    <Card>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 20px",
          borderBottom: `1px solid ${C.gray100}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>{icon}</span>
          <span
            style={{ fontSize: 14, fontWeight: 700, color: C.gray900 }}
          >
            {title}
          </span>
        </div>
        <button
          onClick={onViewAll}
          style={{
            fontSize: 12,
            color: C.primary,
            background: "none",
            border: "none",
            cursor: "pointer",
            fontWeight: 600,
            padding: "4px 8px",
            borderRadius: 5,
          }}
        >
          View all →
        </button>
      </div>

      <div>
        {loading &&
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              style={{
                padding: "13px 20px",
                borderBottom: `1px solid ${C.gray100}`,
                display: "flex",
                gap: 10,
                alignItems: "center",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: C.gray100,
                  animation: "amis-pulse 1.5s ease-in-out infinite",
                  animationDelay: `${i * 0.1}s`,
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    height: 13,
                    borderRadius: 4,
                    background: C.gray100,
                    width: "60%",
                    marginBottom: 5,
                    animation: "amis-pulse 1.5s ease-in-out infinite",
                    animationDelay: `${i * 0.1 + 0.05}s`,
                  }}
                />
                <div
                  style={{
                    height: 11,
                    borderRadius: 4,
                    background: C.gray100,
                    width: "40%",
                    animation: "amis-pulse 1.5s ease-in-out infinite",
                    animationDelay: `${i * 0.1 + 0.1}s`,
                  }}
                />
              </div>
            </div>
          ))}

        {!loading && items.length === 0 && (
          <div
            style={{
              padding: "32px 20px",
              textAlign: "center",
              color: C.gray400,
              fontSize: 13,
            }}
          >
            No records yet
          </div>
        )}

        {!loading && items.map((item, i) => renderItem(item, i))}
      </div>
    </Card>
  );
}

// ── QuickActions ──────────────────────────────────────────────────────────────

function QuickActions({ navigate }: { navigate: (to: string) => void }) {
  const actions = [
    { icon: "👨‍🎓", label: "New Student", to: "/students/new", color: C.blue },
    { icon: "📋", label: "New Application", to: "/admissions/new", color: C.purple },
    { icon: "📅", label: "Register Term", to: "/term-registrations/new", color: C.cyan },
    { icon: "💰", label: "Record Payment", to: "/finance/entry", color: C.green },
    { icon: "📊", label: "New Mark Sheet", to: "/marks/new", color: C.yellow },
    { icon: "👥", label: "Add User", to: "/users/new", color: "#ec4899" },
  ];

  return (
    <Card>
      <div
        style={{
          padding: "16px 20px",
          borderBottom: `1px solid ${C.gray100}`,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 700, color: C.gray900 }}>
          ⚡ Quick Actions
        </span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 1,
          background: C.gray100,
        }}
      >
        {actions.map(({ icon, label, to, color }) => (
          <button
            key={to}
            onClick={() => navigate(to)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "14px 18px",
              background: C.white,
              border: "none",
              cursor: "pointer",
              textAlign: "left",
              fontSize: 13,
              fontWeight: 600,
              color: C.gray700,
              transition: "background 0.12s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = C.gray50;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = C.white;
            }}
          >
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: `${color}18`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
                flexShrink: 0,
              }}
            >
              {icon}
            </span>
            {label}
          </button>
        ))}
      </div>
    </Card>
  );
}

// ── Avatar initials ───────────────────────────────────────────────────────────

function Avatar({ name, color }: { name: string; color: string }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div
      style={{
        width: 34,
        height: 34,
        borderRadius: "50%",
        background: `${color}22`,
        color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 13,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

// ── DashboardPage ─────────────────────────────────────────────────────────────

export function DashboardPage() {
  ensureGlobalCss();
  const navigate = useNavigate();
  const { user } = useAuth();

  const results = useQueries({
    queries: [
      {
        queryKey: ["dash-students"],
        queryFn: () => listStudents({ limit: 100 }),
      },
      {
        queryKey: ["dash-applications"],
        queryFn: () => listApplications({ limit: 100 }),
      },
      {
        queryKey: ["dash-term-regs"],
        queryFn: () => listTermRegistrations({ limit: 100 }),
      },
      {
        queryKey: ["dash-submissions"],
        queryFn: () => listSubmissions({ limit: 100 }),
      },
    ],
  });

  const [stuQ, appQ, tregQ, markQ] = results;

  const students = stuQ.data ?? [];
  const applications = appQ.data ?? [];
  const termRegs = tregQ.data ?? [];
  const submissions = markQ.data ?? [];

  // Recent = first 5 (API returns newest first)
  const recentStudents = students.slice(0, 5);
  const recentApps = applications.slice(0, 5);

  // Applications by state
  const pendingApps = applications.filter(
    (a) => a.current_state && !["ENROLLED", "REJECTED"].includes(a.current_state),
  ).length;

  // Term regs by clearance issued
  const clearedRegs = termRegs.filter(
    (r) => r.current_state === "CLEARANCE_ISSUED",
  ).length;

  return (
    <div style={{ animation: "amis-fadein 0.2s ease-out" }}>
      {/* Welcome banner */}
      {user && <WelcomeBanner email={user.email} role={user.role} />}

      {/* Stats row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
          marginBottom: 28,
        }}
      >
        <StatTile
          icon="👨‍🎓"
          label="Students"
          value={fmt(students.length)}
          sub="enrolled"
          accentColor="#2563eb"
          loading={stuQ.isLoading}
          onClick={() => navigate("/students")}
        />
        <StatTile
          icon="📋"
          label="Applications"
          value={fmt(applications.length)}
          sub={pendingApps > 0 ? `${pendingApps} pending` : "all processed"}
          accentColor="#7c3aed"
          loading={appQ.isLoading}
          onClick={() => navigate("/admissions")}
        />
        <StatTile
          icon="📅"
          label="Term Registrations"
          value={fmt(termRegs.length)}
          sub={clearedRegs > 0 ? `${clearedRegs} cleared` : undefined}
          accentColor="#0891b2"
          loading={tregQ.isLoading}
          onClick={() => navigate("/term-registrations")}
        />
        <StatTile
          icon="📊"
          label="Mark Sheets"
          value={fmt(submissions.length)}
          sub={submissions.filter((s) => s.current_state === "PUBLISHED").length + " published"}
          accentColor="#d97706"
          loading={markQ.isLoading}
          onClick={() => navigate("/marks")}
        />
      </div>

      {/* Main content: 2-col layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 340px",
          gap: 20,
          alignItems: "start",
        }}
      >
        {/* Left: recent lists */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Recent Students */}
          <RecentList
            title="Recent Students"
            icon="👨‍🎓"
            items={recentStudents}
            loading={stuQ.isLoading}
            onViewAll={() => navigate("/students")}
            renderItem={(item, i) => {
              const s = item as {
                id: string;
                first_name: string;
                last_name: string;
                programme: string | null;
                admission_number: string | null;
                created_at: string;
              };
              return (
                <div
                  key={s.id}
                  onClick={() => navigate(`/students/${s.id}`)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 20px",
                    borderBottom: i < recentStudents.length - 1 ? `1px solid ${C.gray100}` : "none",
                    cursor: "pointer",
                    transition: "background 0.12s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background = C.gray50;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background = "transparent";
                  }}
                >
                  <Avatar
                    name={`${s.first_name} ${s.last_name}`}
                    color="#2563eb"
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        color: C.gray900,
                        fontSize: 14,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {s.first_name} {s.last_name}
                    </div>
                    <div style={{ fontSize: 12, color: C.gray400, marginTop: 2 }}>
                      {s.programme ?? "No programme"}{" "}
                      {s.admission_number ? `· ${s.admission_number}` : ""}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: C.gray400, whiteSpace: "nowrap" }}>
                    {relativeTime(s.created_at)}
                  </div>
                </div>
              );
            }}
          />

          {/* Recent Applications */}
          <RecentList
            title="Recent Applications"
            icon="📋"
            items={recentApps}
            loading={appQ.isLoading}
            onViewAll={() => navigate("/admissions")}
            renderItem={(item, i) => {
              const a = item as {
                id: string;
                first_name: string;
                last_name: string;
                programme: string;
                intake: string;
                current_state: string | null;
                created_at: string;
              };

              const stateColor: Record<string, "gray" | "blue" | "green" | "red" | "yellow"> = {
                SUBMITTED: "blue",
                ENROLLED: "green",
                REJECTED: "red",
                IN_REVIEW: "yellow",
              };

              return (
                <div
                  key={a.id}
                  onClick={() => navigate(`/admissions/${a.id}`)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 20px",
                    borderBottom: i < recentApps.length - 1 ? `1px solid ${C.gray100}` : "none",
                    cursor: "pointer",
                    transition: "background 0.12s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background = C.gray50;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background = "transparent";
                  }}
                >
                  <Avatar
                    name={`${a.first_name} ${a.last_name}`}
                    color="#7c3aed"
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        color: C.gray900,
                        fontSize: 14,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {a.first_name} {a.last_name}
                    </div>
                    <div style={{ fontSize: 12, color: C.gray400, marginTop: 2 }}>
                      {a.programme} · {a.intake}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                    {a.current_state && (
                      <Badge
                        label={a.current_state}
                        color={stateColor[a.current_state] ?? "gray"}
                      />
                    )}
                    <div style={{ fontSize: 11, color: C.gray400 }}>
                      {relativeTime(a.created_at)}
                    </div>
                  </div>
                </div>
              );
            }}
          />
        </div>

        {/* Right: quick actions + summary */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <QuickActions navigate={navigate} />

          {/* System status card */}
          <Card padding="20px">
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: C.gray700,
                marginBottom: 14,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              📈 Marks Pipeline
            </div>
            {markQ.isLoading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      height: 12,
                      borderRadius: 4,
                      background: C.gray100,
                      animation: "amis-pulse 1.5s ease-in-out infinite",
                    }}
                  />
                ))}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(["DRAFT", "SUBMITTED", "HOD_REVIEW", "APPROVED", "PUBLISHED"] as const).map(
                  (state) => {
                    const count = submissions.filter((s) => s.current_state === state).length;
                    const pct = submissions.length > 0 ? (count / submissions.length) * 100 : 0;
                    const colors: Record<string, string> = {
                      DRAFT: "#9ca3af",
                      SUBMITTED: "#3b82f6",
                      HOD_REVIEW: "#f59e0b",
                      APPROVED: "#10b981",
                      PUBLISHED: "#8b5cf6",
                    };

                    return (
                      <div key={state}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginBottom: 4,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 12,
                              color: C.gray600 ?? C.gray500,
                              fontWeight: 500,
                            }}
                          >
                            {state}
                          </span>
                          <span style={{ fontSize: 12, color: C.gray500, fontWeight: 600 }}>
                            {count}
                          </span>
                        </div>
                        <div
                          style={{
                            height: 5,
                            borderRadius: 3,
                            background: C.gray100,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${pct}%`,
                              background: colors[state],
                              borderRadius: 3,
                              transition: "width 0.4s ease-out",
                            }}
                          />
                        </div>
                      </div>
                    );
                  },
                )}
                {submissions.length === 0 && (
                  <p style={{ fontSize: 13, color: C.gray400, margin: 0 }}>
                    No mark sheets yet.
                  </p>
                )}
              </div>
            )}
          </Card>

          {/* Module links */}
          <Card>
            <div
              style={{
                padding: "16px 20px",
                borderBottom: `1px solid ${C.gray100}`,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 700, color: C.gray900 }}>
                🗂 All Modules
              </span>
            </div>
            {[
              { icon: "👨‍🎓", label: "Students", to: "/students", color: "#2563eb" },
              { icon: "📋", label: "Admissions", to: "/admissions", color: "#7c3aed" },
              { icon: "📅", label: "Term Registrations", to: "/term-registrations", color: "#0891b2" },
              { icon: "📊", label: "Marks", to: "/marks", color: "#d97706" },
              { icon: "💰", label: "Finance", to: "/finance", color: "#16a34a" },
              { icon: "👥", label: "Users", to: "/users", color: "#db2777" },
              { icon: "⚙️", label: "Admin Studio", to: "/admin-studio", color: "#64748b" },
            ].map(({ icon, label, to, color }, i, arr) => (
              <button
                key={to}
                onClick={() => navigate(to)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  padding: "11px 20px",
                  background: "none",
                  border: "none",
                  borderBottom: i < arr.length - 1 ? `1px solid ${C.gray100}` : "none",
                  cursor: "pointer",
                  textAlign: "left",
                  fontSize: 13,
                  fontWeight: 500,
                  color: C.gray700,
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = C.gray50;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                }}
              >
                <span
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 6,
                    background: `${color}18`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                  }}
                >
                  {icon}
                </span>
                {label}
                <span style={{ marginLeft: "auto", color: C.gray300, fontSize: 15 }}>›</span>
              </button>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}
