import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createDraft, getConfigStatus } from "./admin-studio.api";

const ALL_ROLES = [
  "admin",
  "registrar",
  "hod",
  "instructor",
  "finance",
  "principal",
] as const;

interface NavItem {
  label: string;
  route: string;
}

const inputStyle: React.CSSProperties = {
  padding: "6px 10px",
  border: "1px solid #d1d5db",
  borderRadius: 4,
  fontSize: 13,
  color: "#0f172a",
};

const btnStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: 4,
  padding: "5px 12px",
  cursor: "pointer",
  fontSize: 13,
  background: "#fff",
  color: "#374151",
};

const btnPrimary: React.CSSProperties = {
  ...btnStyle,
  background: "#2563eb",
  color: "#fff",
  border: "1px solid #2563eb",
  padding: "7px 18px",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 12px",
  border: "1px solid #e2e8f0",
  fontWeight: 600,
  color: "#374151",
  background: "#f1f5f9",
  fontSize: 13,
};

const tdStyle: React.CSSProperties = {
  padding: "8px 12px",
  border: "1px solid #e2e8f0",
  fontSize: 13,
};

export function NavigationEditor() {
  const {
    data: status,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["config/status"],
    queryFn: getConfigStatus,
    staleTime: 30_000,
  });

  const [selectedRole, setSelectedRole] = useState<string>("admin");
  const [navItems, setNavItems] = useState<NavItem[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [newRoute, setNewRoute] = useState("");
  const [savedMsg, setSavedMsg] = useState(false);

  const payload = (status?.draft?.payload ??
    status?.published?.payload ??
    {}) as Record<string, unknown>;
  const navigation = (payload.navigation ?? {}) as Record<string, NavItem[]>;
  const payloadStr = JSON.stringify(payload);

  // Sync nav items when role or payload changes
  useEffect(() => {
    setNavItems(navigation[selectedRole] ?? []);
    setSavedMsg(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRole, payloadStr]);

  const saveMut = useMutation({
    mutationFn: () => {
      const updatedPayload: Record<string, unknown> = {
        ...JSON.parse(payloadStr),
        navigation: {
          ...navigation,
          [selectedRole]: navItems,
        },
      };
      return createDraft(updatedPayload);
    },
    onSuccess: () => {
      setSavedMsg(true);
      void refetch();
    },
  });

  if (isLoading) return <p style={{ color: "#64748b" }}>Loading…</p>;

  function addItem() {
    const label = newLabel.trim();
    const route = newRoute.trim();
    if (!label || !route) return;
    setNavItems((prev) => [...prev, { label, route }]);
    setNewLabel("");
    setNewRoute("");
    setSavedMsg(false);
  }

  function removeItem(i: number) {
    setNavItems((prev) => prev.filter((_, idx) => idx !== i));
    setSavedMsg(false);
  }

  function moveUp(i: number) {
    if (i === 0) return;
    setNavItems((prev) => {
      const next = [...prev];
      [next[i - 1], next[i]] = [next[i], next[i - 1]];
      return next;
    });
    setSavedMsg(false);
  }

  function moveDown(i: number) {
    setNavItems((prev) => {
      if (i >= prev.length - 1) return prev;
      const next = [...prev];
      [next[i + 1], next[i]] = [next[i], next[i + 1]];
      return next;
    });
    setSavedMsg(false);
  }

  return (
    <div style={{ maxWidth: 680 }}>
      <h2 style={{ marginTop: 0, marginBottom: 24, color: "#0f172a" }}>
        Navigation Editor
      </h2>

      <div
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          padding: 24,
        }}
      >
        {/* Role selector */}
        <div style={{ marginBottom: 20 }}>
          <label
            style={{
              fontWeight: 600,
              marginRight: 10,
              fontSize: 13,
              color: "#374151",
            }}
          >
            Role:
          </label>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            style={{ ...inputStyle, minWidth: 130 }}
          >
            {ALL_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        {/* Nav items table */}
        <table
          style={{
            borderCollapse: "collapse",
            width: "100%",
            marginBottom: 16,
          }}
        >
          <thead>
            <tr>
              <th style={thStyle}>#</th>
              <th style={thStyle}>Label</th>
              <th style={thStyle}>Route</th>
              <th style={{ ...thStyle, textAlign: "center" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {navItems.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  style={{
                    ...tdStyle,
                    color: "#94a3b8",
                    fontStyle: "italic",
                    textAlign: "center",
                    padding: 20,
                  }}
                >
                  No nav items for{" "}
                  <strong style={{ fontStyle: "normal" }}>
                    {selectedRole}
                  </strong>
                  . Add one below.
                </td>
              </tr>
            ) : (
              navItems.map((item, i) => (
                <tr key={i}>
                  <td style={{ ...tdStyle, color: "#94a3b8", width: 32 }}>
                    {i + 1}
                  </td>
                  <td style={tdStyle}>{item.label}</td>
                  <td
                    style={{
                      ...tdStyle,
                      fontFamily: "monospace",
                      fontSize: 12,
                    }}
                  >
                    {item.route}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    <div
                      style={{
                        display: "flex",
                        gap: 4,
                        justifyContent: "center",
                      }}
                    >
                      <button
                        style={btnStyle}
                        onClick={() => moveUp(i)}
                        disabled={i === 0}
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        style={btnStyle}
                        onClick={() => moveDown(i)}
                        disabled={i === navItems.length - 1}
                        title="Move down"
                      >
                        ↓
                      </button>
                      <button
                        style={{
                          ...btnStyle,
                          color: "#dc2626",
                          borderColor: "#fca5a5",
                        }}
                        onClick={() => removeItem(i)}
                        title="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Add new item */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 20,
            alignItems: "center",
          }}
        >
          <input
            placeholder="Label"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addItem()}
            style={{ ...inputStyle, width: 160 }}
          />
          <input
            placeholder="/route"
            value={newRoute}
            onChange={(e) => setNewRoute(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addItem()}
            style={{ ...inputStyle, width: 200 }}
          />
          <button
            style={btnStyle}
            onClick={addItem}
            disabled={!newLabel.trim() || !newRoute.trim()}
          >
            + Add
          </button>
        </div>

        {/* Save */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            style={btnPrimary}
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending}
          >
            {saveMut.isPending ? "Saving…" : "Save as Draft"}
          </button>
          {savedMsg && (
            <span style={{ color: "#16a34a", fontSize: 13, fontWeight: 500 }}>
              ✓ Saved as draft
            </span>
          )}
          {saveMut.isError && (
            <span style={{ color: "#dc2626", fontSize: 13 }}>
              Failed to save
            </span>
          )}
        </div>
        <p
          style={{
            fontSize: 12,
            color: "#94a3b8",
            marginBottom: 0,
            marginTop: 10,
          }}
        >
          Changes are saved as a draft. Go to{" "}
          <a href="/admin-studio/editor" style={{ color: "#2563eb" }}>
            Config Editor
          </a>{" "}
          to publish.
        </p>
      </div>
    </div>
  );
}
