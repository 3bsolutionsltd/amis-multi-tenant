import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/apiFetch";

/* ------------------------------------------------------------------ types */

interface GradingScale {
  id: string;
  name: string;
  is_default: boolean;
}

interface GradeBoundary {
  id: string;
  grade_letter: string;
  description: string | null;
  min_score: number;
  max_score: number;
  grade_point: number | null;
}

interface ScaleDetail extends GradingScale {
  boundaries: GradeBoundary[];
}

type BoundaryRow = {
  grade_letter: string;
  description: string;
  min_score: string;
  max_score: string;
  grade_point: string;
};

/* ------------------------------------------------------------------ styles */

const th: React.CSSProperties = {
  textAlign: "left", padding: "9px 12px", border: "1px solid #e2e8f0",
  fontWeight: 600, color: "#374151", background: "#f1f5f9", fontSize: 12,
};
const td: React.CSSProperties = {
  padding: "8px 12px", border: "1px solid #e2e8f0", fontSize: 13,
};
const inputSt: React.CSSProperties = {
  padding: "6px 9px", border: "1px solid #d1d5db", borderRadius: 5, fontSize: 13,
  width: "100%", boxSizing: "border-box",
};

/* ---------------------------------------------------------------- component */

export function GradingScaleEditor() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [showCreateScale, setShowCreateScale] = useState(false);
  const [newScaleName, setNewScaleName] = useState("");
  const [boundaries, setBoundaries] = useState<BoundaryRow[]>([]);
  const [scaleError, setScaleError] = useState<string | null>(null);
  const [boundaryError, setBoundaryError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  /* ---- queries ---- */

  const { data: scales = [] } = useQuery<GradingScale[]>({
    queryKey: ["grading-scales"],
    queryFn: () => apiFetch<{ data: GradingScale[] }>("/grading-scales?limit=50").then((r) => (r as any).data ?? r),
    staleTime: 60_000,
  });

  const { data: detail, isLoading: detailLoading } = useQuery<ScaleDetail>({
    queryKey: ["grading-scale", selectedId],
    queryFn: () => apiFetch<ScaleDetail>(`/grading-scales/${selectedId}`),
    enabled: !!selectedId,
    staleTime: 30_000,
    onSuccess: (d: ScaleDetail) => {
      setBoundaries(
        d.boundaries.map((b) => ({
          grade_letter: b.grade_letter,
          description: b.description ?? "",
          min_score: String(b.min_score),
          max_score: String(b.max_score),
          grade_point: b.grade_point != null ? String(b.grade_point) : "",
        }))
      );
      setEditName(d.name);
    },
  } as any);

  /* ---- mutations ---- */

  const createScaleMut = useMutation({
    mutationFn: (name: string) => apiFetch("/grading-scales", { method: "POST", body: JSON.stringify({ name, is_default: scales.length === 0 }) }),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["grading-scales"] });
      setSelectedId(res.id);
      setShowCreateScale(false);
      setNewScaleName("");
    },
    onError: () => setScaleError("Failed to create scale"),
  });

  const updateScaleMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: object }) =>
      apiFetch(`/grading-scales/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["grading-scales"] });
      qc.invalidateQueries({ queryKey: ["grading-scale", selectedId] });
      setSuccessMsg("Scale updated.");
    },
    onError: () => setScaleError("Failed to update scale"),
  });

  const bulkMut = useMutation({
    mutationFn: (rows: object[]) =>
      apiFetch(`/grading-scales/${selectedId}/boundaries/bulk`, { method: "POST", body: JSON.stringify(rows) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["grading-scale", selectedId] });
      setBoundaryError(null);
      setSuccessMsg("Boundaries saved.");
    },
    onError: () => setBoundaryError("Failed to save boundaries"),
  });

  /* ---- boundary row helpers ---- */

  function addRow() {
    setBoundaries((prev) => [...prev, { grade_letter: "", description: "", min_score: "", max_score: "", grade_point: "" }]);
  }

  function removeRow(i: number) {
    setBoundaries((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateRow(i: number, field: keyof BoundaryRow, value: string) {
    setBoundaries((prev) => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  }

  function saveBoundaries() {
    setBoundaryError(null);
    setSuccessMsg(null);
    const rows = boundaries.map((r) => ({
      grade_letter: r.grade_letter.trim(),
      description: r.description || undefined,
      min_score: parseFloat(r.min_score),
      max_score: parseFloat(r.max_score),
      grade_point: r.grade_point !== "" ? parseFloat(r.grade_point) : undefined,
    }));
    const invalid = rows.find((r) => !r.grade_letter || isNaN(r.min_score) || isNaN(r.max_score));
    if (invalid) { setBoundaryError("Fill all required fields (Grade, Min, Max) in every row."); return; }
    bulkMut.mutate(rows);
  }

  return (
    <div style={{ maxWidth: 900, display: "flex", gap: 24 }}>
      {/* Sidebar: scale list */}
      <div style={{ width: 220, flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Scales</h3>
          <button
            onClick={() => { setShowCreateScale(true); setScaleError(null); }}
            style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 5, padding: "4px 10px", fontSize: 12, cursor: "pointer", fontWeight: 700 }}
          >
            + New
          </button>
        </div>

        {showCreateScale && (
          <div style={{ background: "#f1f5f9", borderRadius: 7, padding: 12, marginBottom: 10 }}>
            <input
              value={newScaleName}
              onChange={(e) => setNewScaleName(e.target.value)}
              placeholder="Scale name…"
              style={inputSt}
            />
            {scaleError && <div style={{ color: "#dc2626", fontSize: 11, marginTop: 4 }}>{scaleError}</div>}
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <button
                onClick={() => { if (newScaleName.trim()) createScaleMut.mutate(newScaleName.trim()); }}
                disabled={createScaleMut.isPending}
                style={{ flex: 1, background: "#2563eb", color: "#fff", border: "none", borderRadius: 5, padding: "6px 0", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >
                {createScaleMut.isPending ? "…" : "Create"}
              </button>
              <button onClick={() => setShowCreateScale(false)} style={{ flex: 1, background: "#fff", border: "1px solid #d1d5db", borderRadius: 5, padding: "6px 0", fontSize: 12, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {scales.map((s) => (
            <button
              key={s.id}
              onClick={() => { setSelectedId(s.id); setSuccessMsg(null); setBoundaryError(null); setScaleError(null); }}
              style={{
                padding: "9px 12px", borderRadius: 7, border: "1px solid",
                borderColor: selectedId === s.id ? "#2563eb" : "#e2e8f0",
                background: selectedId === s.id ? "#eff6ff" : "#fff",
                cursor: "pointer", textAlign: "left",
                color: selectedId === s.id ? "#1d4ed8" : "#374151", fontSize: 13, fontWeight: selectedId === s.id ? 700 : 400,
              }}
            >
              {s.name}
              {s.is_default && <span style={{ marginLeft: 6, fontSize: 10, background: "#dcfce7", color: "#15803d", padding: "1px 5px", borderRadius: 10, fontWeight: 700 }}>DEFAULT</span>}
            </button>
          ))}
          {scales.length === 0 && <p style={{ fontSize: 13, color: "#94a3b8", margin: 4 }}>No scales yet.</p>}
        </div>
      </div>

      {/* Main panel */}
      <div style={{ flex: 1 }}>
        {!selectedId ? (
          <div style={{ padding: 40, textAlign: "center", color: "#94a3b8", background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0" }}>
            <p style={{ margin: 0, fontSize: 15 }}>Select a grading scale on the left, or create a new one.</p>
          </div>
        ) : detailLoading ? (
          <p style={{ color: "#64748b" }}>Loading…</p>
        ) : detail ? (
          <>
            {/* Scale header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  style={{ ...inputSt, width: 220, fontWeight: 700, fontSize: 15 }}
                />
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={detail.is_default}
                    onChange={(e) => updateScaleMut.mutate({ id: selectedId, body: { is_default: e.target.checked } })}
                  />
                  Set as default
                </label>
                <button
                  onClick={() => updateScaleMut.mutate({ id: selectedId, body: { name: editName } })}
                  disabled={updateScaleMut.isPending}
                  style={{ padding: "6px 14px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                  Rename
                </button>
              </div>
            </div>

            {/* Grade boundaries table */}
            <h4 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700, color: "#374151" }}>Grade Boundaries</h4>
            <table style={{ borderCollapse: "collapse", width: "100%", marginBottom: 12 }}>
              <thead>
                <tr>
                  <th style={th}>Grade *</th>
                  <th style={th}>Description</th>
                  <th style={th}>Min Score *</th>
                  <th style={th}>Max Score *</th>
                  <th style={th}>Grade Point</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {boundaries.map((row, i) => (
                  <tr key={i}>
                    <td style={td}>
                      <input value={row.grade_letter} onChange={(e) => updateRow(i, "grade_letter", e.target.value)} style={{ ...inputSt, width: 60 }} maxLength={5} placeholder="A" />
                    </td>
                    <td style={td}>
                      <input value={row.description} onChange={(e) => updateRow(i, "description", e.target.value)} style={inputSt} placeholder="e.g. Distinction" />
                    </td>
                    <td style={td}>
                      <input type="number" min={0} max={100} value={row.min_score} onChange={(e) => updateRow(i, "min_score", e.target.value)} style={{ ...inputSt, width: 80 }} />
                    </td>
                    <td style={td}>
                      <input type="number" min={0} max={100} value={row.max_score} onChange={(e) => updateRow(i, "max_score", e.target.value)} style={{ ...inputSt, width: 80 }} />
                    </td>
                    <td style={td}>
                      <input type="number" min={0} step={0.1} value={row.grade_point} onChange={(e) => updateRow(i, "grade_point", e.target.value)} style={{ ...inputSt, width: 80 }} placeholder="4.0" />
                    </td>
                    <td style={td}>
                      <button onClick={() => removeRow(i)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 16, padding: "0 4px" }} title="Remove row">✕</button>
                    </td>
                  </tr>
                ))}
                {boundaries.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ ...td, color: "#94a3b8", textAlign: "center", padding: 20 }}>
                      No boundaries yet. Click <strong>+ Add Row</strong>.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button onClick={addRow} style={{ padding: "7px 14px", background: "#fff", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, cursor: "pointer" }}>
                + Add Row
              </button>
              <button
                onClick={saveBoundaries}
                disabled={bulkMut.isPending}
                style={{ padding: "8px 20px", background: bulkMut.isPending ? "#4ade80" : "#16a34a", color: "#fff", border: "none", borderRadius: 7, fontWeight: 700, fontSize: 13, cursor: bulkMut.isPending ? "not-allowed" : "pointer" }}
              >
                {bulkMut.isPending ? "Saving…" : "Save Boundaries"}
              </button>
            </div>

            {boundaryError && <div style={{ padding: "8px 14px", background: "#fee2e2", color: "#dc2626", borderRadius: 6, fontSize: 13, marginTop: 12 }}>{boundaryError}</div>}
            {successMsg && <div style={{ padding: "8px 14px", background: "#dcfce7", color: "#15803d", borderRadius: 6, fontSize: 13, marginTop: 12, fontWeight: 600 }}>✓ {successMsg}</div>}
          </>
        ) : null}
      </div>
    </div>
  );
}
