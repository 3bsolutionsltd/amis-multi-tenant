import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createDraft, getConfigStatus, publishConfig } from "./admin-studio.api";

const ALL_ROLES = [
  "admin",
  "registrar",
  "hod",
  "instructor",
  "finance",
  "principal",
  "dean",
] as const;
type NavRole = typeof ALL_ROLES[number];

interface NavItem {
  label: string;
  route: string;
  icon?: string;
}

/* Common app routes for autocomplete suggestions */
const ROUTE_SUGGESTIONS = [
  "/dashboard",
  "/students",
  "/students/new",
  "/admissions",
  "/admissions/new",
  "/term-registrations",
  "/term-registrations/new",
  "/marks",
  "/marks/bulk",
  "/fees",
  "/fees/entry",
  "/fees/overview",
  "/staff",
  "/staff/new",
  "/programmes",
  "/industrial-training",
  "/field-placements",
  "/analytics",
  "/results",
  "/results/analysis",
  "/timetable",
  "/attendance",
  "/alumni",
  "/clearance",
  "/reports/class-list",
  "/reports/fee-collection",
  "/reports/it",
  "/reports/evaluations",
  "/reports/nche",
  "/users",
];

/* Friendly icons list (emoji) */
const ICON_OPTIONS = [
  { v: "", label: "— none —" },
  { v: "🏠", label: "🏠 Home" },
  { v: "👥", label: "👥 Students" },
  { v: "📝", label: "📝 Applications" },
  { v: "📋", label: "📋 Registrations" },
  { v: "🎓", label: "🎓 Results / Marks" },
  { v: "💰", label: "💰 Fees" },
  { v: "📅", label: "📅 Timetable" },
  { v: "✅", label: "✅ Attendance" },
  { v: "👤", label: "👤 Staff" },
  { v: "📊", label: "📊 Analytics / Reports" },
  { v: "📚", label: "📚 Programmes" },
  { v: "🏭", label: "🏭 Industrial Training" },
  { v: "⚙️", label: "⚙️ Settings" },
  { v: "🔔", label: "🔔 Notifications" },
  { v: "🧹", label: "🧹 Clearance" },
];

/* ── styles ── */
const inputSt: React.CSSProperties = {
  padding: "6px 10px",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  fontSize: 13,
  color: "#0f172a",
  background: "#fff",
};

const btnSt: React.CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: 6,
  padding: "5px 12px",
  cursor: "pointer",
  fontSize: 13,
  background: "#fff",
  color: "#374151",
};

const btnPrimary: React.CSSProperties = {
  ...btnSt,
  background: "#2563eb",
  color: "#fff",
  border: "none",
  padding: "8px 20px",
  fontWeight: 700,
};

const thSt: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 12px",
  border: "1px solid #e2e8f0",
  fontWeight: 600,
  color: "#374151",
  background: "#f1f5f9",
  fontSize: 13,
};

const tdSt: React.CSSProperties = {
  padding: "7px 10px",
  border: "1px solid #e2e8f0",
  fontSize: 13,
  verticalAlign: "middle",
};

/* ── component ── */
export function NavigationEditor() {
  const { data: status, isLoading, refetch } = useQuery({
    queryKey: ["config/status"],
    queryFn: getConfigStatus,
    staleTime: 30_000,
  });

  const [selectedRole, setSelectedRole] = useState<NavRole>("admin");
  const [navItems, setNavItems] = useState<NavItem[]>([]);
  const [savedMsg, setSavedMsg] = useState<"draft" | "published" | null>(null);
  const [dirty, setDirty] = useState(false);

  // Add new item form
  const [newLabel, setNewLabel] = useState("");
  const [newRoute, setNewRoute] = useState("");
  const [newIcon, setNewIcon] = useState("");

  // Inline edit state
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editRoute, setEditRoute] = useState("");
  const [editIcon, setEditIcon] = useState("");

  // Copy-from-role
  const [copyFrom, setCopyFrom] = useState<NavRole | "">("");

  const qc = useQueryClient();
  const role = localStorage.getItem("amis_dev_role") ?? "admin";

  const payload = (status?.draft?.payload ?? status?.published?.payload ?? {}) as Record<string, unknown>;
  const navigation = (payload.navigation ?? {}) as Record<string, NavItem[]>;
  const payloadStr = JSON.stringify(payload);

  useEffect(() => {
    setNavItems(navigation[selectedRole] ?? []);
    setSavedMsg(null);
    setDirty(false);
    setEditIdx(null);
    setCopyFrom("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRole, payloadStr]);

  function buildUpdatedPayload() {
    return {
      ...JSON.parse(payloadStr),
      navigation: { ...navigation, [selectedRole]: navItems },
    } as Record<string, unknown>;
  }

  const saveMut = useMutation({
    mutationFn: () => createDraft(buildUpdatedPayload()),
    onSuccess: () => { setSavedMsg("draft"); setDirty(false); void refetch(); },
  });

  const saveAndPublishMut = useMutation({
    mutationFn: async () => {
      await createDraft(buildUpdatedPayload());
      return publishConfig(role);
    },
    onSuccess: () => {
      setSavedMsg("published"); setDirty(false);
      qc.invalidateQueries({ queryKey: ["config"] });
      void refetch();
    },
  });

  if (isLoading) return <p style={{ color: "#64748b" }}>Loading…</p>;

  /* ── item mutations ── */
  function addItem() {
    const label = newLabel.trim();
    const route = newRoute.trim();
    if (!label || !route) return;
    setNavItems((prev) => [...prev, { label, route, icon: newIcon || undefined }]);
    setNewLabel(""); setNewRoute(""); setNewIcon("");
    setSavedMsg(null); setDirty(true);
  }

  function removeItem(i: number) {
    setNavItems((prev) => prev.filter((_, idx) => idx !== i));
    setEditIdx(null); setSavedMsg(null); setDirty(true);
  }

  function moveUp(i: number) {
    if (i === 0) return;
    setNavItems((prev) => { const n = [...prev]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n; });
    setSavedMsg(null); setDirty(true);
  }

  function moveDown(i: number) {
    setNavItems((prev) => {
      if (i >= prev.length - 1) return prev;
      const n = [...prev]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; return n;
    });
    setSavedMsg(null); setDirty(true);
  }

  function startEdit(i: number) {
    setEditIdx(i);
    setEditLabel(navItems[i].label);
    setEditRoute(navItems[i].route);
    setEditIcon(navItems[i].icon ?? "");
  }

  function commitEdit(i: number) {
    const label = editLabel.trim();
    const route = editRoute.trim();
    if (!label || !route) return;
    setNavItems((prev) => prev.map((item, idx) => idx === i ? { label, route, icon: editIcon || undefined } : item));
    setEditIdx(null); setSavedMsg(null); setDirty(true);
  }

  function copyFromRole() {
    if (!copyFrom) return;
    const source = navigation[copyFrom] ?? [];
    if (source.length === 0) return;
    setNavItems([...source]);
    setCopyFrom(""); setSavedMsg(null); setDirty(true);
  }

  /* ── render ── */
  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: "0 0 4px", fontSize: 22, color: "#0f172a" }}>Navigation Editor</h2>
          <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>
            Configure sidebar navigation items per role. Changes apply after publishing.
          </p>
        </div>
        {dirty && (
          <span style={{ fontSize: 12, background: "#fef9c3", color: "#92400e", padding: "4px 10px", borderRadius: 6, border: "1px solid #fde68a", fontWeight: 600 }}>
            Unsaved changes
          </span>
        )}
      </div>

      {/* Role tabs */}
      <div style={{ display: "flex", gap: 2, flexWrap: "wrap", marginBottom: 20, borderBottom: "2px solid #e2e8f0" }}>
        {ALL_ROLES.map((r) => (
          <button
            key={r}
            onClick={() => setSelectedRole(r)}
            style={{
              padding: "8px 16px",
              border: "none",
              borderBottom: selectedRole === r ? "2px solid #2563eb" : "2px solid transparent",
              background: "none",
              color: selectedRole === r ? "#2563eb" : "#64748b",
              fontWeight: selectedRole === r ? 700 : 400,
              fontSize: 13,
              cursor: "pointer",
              marginBottom: -2,
            }}
          >
            {r.charAt(0).toUpperCase() + r.slice(1)}
            <span style={{ marginLeft: 5, fontSize: 11, color: "#94a3b8" }}>
              ({(navigation[r] ?? []).length})
            </span>
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
        {/* ── Left: editor panel ── */}
        <div style={{ flex: 1, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 20 }}>

          {/* Copy from role */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16, padding: "10px 12px", background: "#f8fafc", borderRadius: 7, border: "1px solid #e2e8f0" }}>
            <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600, whiteSpace: "nowrap" }}>Copy from:</span>
            <select
              value={copyFrom}
              onChange={(e) => setCopyFrom(e.target.value as NavRole | "")}
              style={{ ...inputSt, flex: 1 }}
            >
              <option value="">— select role —</option>
              {ALL_ROLES.filter((r) => r !== selectedRole).map((r) => (
                <option key={r} value={r}>
                  {r} ({(navigation[r] ?? []).length} items)
                </option>
              ))}
            </select>
            <button
              onClick={copyFromRole}
              disabled={!copyFrom}
              style={{ ...btnSt, background: copyFrom ? "#0f172a" : "#f1f5f9", color: copyFrom ? "#fff" : "#94a3b8", border: "none", whiteSpace: "nowrap" }}
            >
              Copy &amp; Replace
            </button>
          </div>

          {/* Nav items table */}
          <datalist id="route-suggestions">
            {ROUTE_SUGGESTIONS.map((r) => <option key={r} value={r} />)}
          </datalist>

          <table style={{ borderCollapse: "collapse", width: "100%", marginBottom: 14 }}>
            <thead>
              <tr>
                <th style={{ ...thSt, width: 28 }}>#</th>
                <th style={thSt}>Icon</th>
                <th style={thSt}>Label</th>
                <th style={thSt}>Route</th>
                <th style={{ ...thSt, textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {navItems.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ ...tdSt, color: "#94a3b8", fontStyle: "italic", textAlign: "center", padding: 24 }}>
                    No items for <strong style={{ fontStyle: "normal" }}>{selectedRole}</strong>. Add one below or copy from another role.
                  </td>
                </tr>
              ) : (
                navItems.map((item, i) =>
                  editIdx === i ? (
                    /* Inline edit row */
                    <tr key={i} style={{ background: "#eff6ff" }}>
                      <td style={{ ...tdSt, color: "#94a3b8" }}>{i + 1}</td>
                      <td style={tdSt}>
                        <select value={editIcon} onChange={(e) => setEditIcon(e.target.value)} style={{ ...inputSt, width: 120, fontSize: 12 }}>
                          {ICON_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                        </select>
                      </td>
                      <td style={tdSt}>
                        <input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} style={{ ...inputSt, width: "100%" }} autoFocus />
                      </td>
                      <td style={tdSt}>
                        <input value={editRoute} onChange={(e) => setEditRoute(e.target.value)} list="route-suggestions" style={{ ...inputSt, width: "100%", fontFamily: "monospace", fontSize: 12 }} />
                      </td>
                      <td style={{ ...tdSt, textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                          <button onClick={() => commitEdit(i)} style={{ ...btnSt, background: "#2563eb", color: "#fff", border: "none" }}>✓</button>
                          <button onClick={() => setEditIdx(null)} style={btnSt}>✕</button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    /* Display row */
                    <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                      <td style={{ ...tdSt, color: "#94a3b8", width: 28 }}>{i + 1}</td>
                      <td style={{ ...tdSt, fontSize: 16, textAlign: "center" }}>{item.icon ?? "—"}</td>
                      <td style={tdSt}>{item.label}</td>
                      <td style={{ ...tdSt, fontFamily: "monospace", fontSize: 12, color: "#475569" }}>{item.route}</td>
                      <td style={{ ...tdSt, textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 3, justifyContent: "center" }}>
                          <button style={btnSt} onClick={() => moveUp(i)} disabled={i === 0} title="Move up">↑</button>
                          <button style={btnSt} onClick={() => moveDown(i)} disabled={i === navItems.length - 1} title="Move down">↓</button>
                          <button style={{ ...btnSt, color: "#2563eb", borderColor: "#bfdbfe" }} onClick={() => startEdit(i)} title="Edit">✎</button>
                          <button style={{ ...btnSt, color: "#dc2626", borderColor: "#fca5a5" }} onClick={() => removeItem(i)} title="Remove">✕</button>
                        </div>
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>

          {/* Add new item row */}
          <div style={{ display: "flex", gap: 8, padding: "12px 10px", background: "#f8fafc", borderRadius: 7, border: "1px dashed #cbd5e1", alignItems: "center", flexWrap: "wrap" }}>
            <select value={newIcon} onChange={(e) => setNewIcon(e.target.value)} style={{ ...inputSt, width: 130, fontSize: 12 }}>
              {ICON_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
            </select>
            <input
              placeholder="Label"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addItem()}
              style={{ ...inputSt, flex: 1, minWidth: 120 }}
            />
            <input
              placeholder="/route"
              value={newRoute}
              onChange={(e) => setNewRoute(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addItem()}
              list="route-suggestions"
              style={{ ...inputSt, flex: 1, minWidth: 140, fontFamily: "monospace", fontSize: 12 }}
            />
            <button
              onClick={addItem}
              disabled={!newLabel.trim() || !newRoute.trim()}
              style={{ ...btnSt, background: newLabel.trim() && newRoute.trim() ? "#0f172a" : "#f1f5f9", color: newLabel.trim() && newRoute.trim() ? "#fff" : "#94a3b8", border: "none", whiteSpace: "nowrap" }}
            >
              + Add Item
            </button>
          </div>

          {/* Save buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
            <button style={btnPrimary} onClick={() => saveMut.mutate()} disabled={saveMut.isPending || saveAndPublishMut.isPending}>
              {saveMut.isPending ? "Saving…" : "Save as Draft"}
            </button>
            <button
              style={{ ...btnPrimary, background: "#16a34a" }}
              onClick={() => saveAndPublishMut.mutate()}
              disabled={saveMut.isPending || saveAndPublishMut.isPending}
            >
              {saveAndPublishMut.isPending ? "Publishing…" : "Save & Publish"}
            </button>
            {savedMsg === "draft" && <span style={{ color: "#2563eb", fontSize: 13, fontWeight: 500 }}>✓ Saved as draft</span>}
            {savedMsg === "published" && <span style={{ color: "#16a34a", fontSize: 13, fontWeight: 500 }}>✓ Published</span>}
            {(saveMut.isError || saveAndPublishMut.isError) && <span style={{ color: "#dc2626", fontSize: 13 }}>Failed to save</span>}
          </div>
        </div>

        {/* ── Right: sidebar preview ── */}
        <div style={{ width: 180, flexShrink: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
            Preview
          </div>
          <div style={{ background: "#0f172a", borderRadius: 10, padding: "12px 0", minHeight: 300 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 1, padding: "4px 16px 8px" }}>
              {selectedRole}
            </div>
            {navItems.length === 0 ? (
              <div style={{ fontSize: 12, color: "#475569", padding: "0 16px", fontStyle: "italic" }}>No items</div>
            ) : (
              navItems.map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 16px",
                    fontSize: 13,
                    color: i === 0 ? "#fff" : "#94a3b8",
                    background: i === 0 ? "#1e3a5f" : "transparent",
                    borderLeft: i === 0 ? "3px solid #60a5fa" : "3px solid transparent",
                    fontWeight: i === 0 ? 600 : 400,
                  }}
                >
                  {item.icon && <span style={{ fontSize: 14 }}>{item.icon}</span>}
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
                </div>
              ))
            )}
          </div>
          <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 8, lineHeight: 1.4 }}>
            First item shown as active. Actual highlight depends on current route.
          </p>
        </div>
      </div>
    </div>
  );
}
