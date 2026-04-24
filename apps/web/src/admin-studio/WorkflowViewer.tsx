import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getConfigStatus, createDraft, publishConfig } from "./admin-studio.api";

interface WorkflowTransition {
  action: string;
  from: string;
  to: string;
  required_role?: string;
}

const ROLES = [
  "registrar",
  "finance",
  "dean",
  "hod",
  "principal",
  "instructor",
  "admin",
];

interface WorkflowDef {
  initial_state: string;
  states: string[];
  transitions: WorkflowTransition[];
}

/* ------------------------------------------------------------------ styles */

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  padding: 24,
  marginBottom: 20,
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 14px",
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
  color: "#0f172a",
};

const inputSt: React.CSSProperties = {
  padding: "6px 10px",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  fontSize: 13,
  width: "100%",
  boxSizing: "border-box",
};

const selectSt: React.CSSProperties = { ...inputSt };

/* ---- built-in seed workflows (mirrors API DEFAULT_WORKFLOWS) ----------- */
// These are used to pre-populate the editor when no workflows have been
// published yet, so the admin sees (and can customise) the active defaults.
const SEED_WORKFLOWS: Record<string, WorkflowDef> = {
  term_registration: {
    initial_state: "REGISTERED",
    states: [
      "REGISTERED", "DOCS_VERIFIED", "FEE_PAID", "GUILD_FEE_VERIFIED",
      "ENROLLMENT_ENDORSED", "PPE_ISSUED", "HALL_ALLOCATED", "MEAL_CARD_ISSUED",
      "HOD_VERIFIED", "MEDICAL_CLEARED", "LIBRARY_CARD_ISSUED",
      "ONLINE_REGISTERED", "EXAM_ENROLLED",
    ],
    transitions: [
      { action: "verify_docs",        from: "REGISTERED",           to: "DOCS_VERIFIED",        required_role: "registrar" },
      { action: "verify_payment",     from: "DOCS_VERIFIED",        to: "FEE_PAID",             required_role: "finance"   },
      { action: "verify_guild_fee",   from: "FEE_PAID",             to: "GUILD_FEE_VERIFIED",   required_role: "dean"      },
      { action: "endorse_enrollment", from: "GUILD_FEE_VERIFIED",   to: "ENROLLMENT_ENDORSED",  required_role: "dean"      },
      { action: "issue_ppe",          from: "ENROLLMENT_ENDORSED",  to: "PPE_ISSUED",           required_role: "admin"     },
      { action: "allocate_hall",      from: "PPE_ISSUED",           to: "HALL_ALLOCATED",       required_role: "admin"     },
      { action: "issue_meal_card",    from: "HALL_ALLOCATED",       to: "MEAL_CARD_ISSUED",     required_role: "admin"     },
      { action: "hod_verify",         from: "MEAL_CARD_ISSUED",     to: "HOD_VERIFIED",         required_role: "hod"       },
      { action: "medical_clear",      from: "HOD_VERIFIED",         to: "MEDICAL_CLEARED",      required_role: "admin"     },
      { action: "issue_library_card", from: "MEDICAL_CLEARED",      to: "LIBRARY_CARD_ISSUED",  required_role: "admin"     },
      { action: "online_register",    from: "LIBRARY_CARD_ISSUED",  to: "ONLINE_REGISTERED",    required_role: "admin"     },
      { action: "enroll_for_exams",   from: "ONLINE_REGISTERED",    to: "EXAM_ENROLLED",        required_role: "registrar" },
    ],
  },
  marks: {
    initial_state: "DRAFT",
    states: ["DRAFT", "SUBMITTED", "HOD_REVIEW", "APPROVED", "PUBLISHED"],
    transitions: [
      { action: "submit",  from: "DRAFT",       to: "SUBMITTED",  required_role: "instructor" },
      { action: "review",  from: "SUBMITTED",   to: "HOD_REVIEW", required_role: "hod"        },
      { action: "approve", from: "HOD_REVIEW",  to: "APPROVED",   required_role: "hod"        },
      { action: "return",  from: "HOD_REVIEW",  to: "DRAFT",      required_role: "hod"        },
      { action: "publish", from: "APPROVED",    to: "PUBLISHED",  required_role: "registrar"  },
    ],
  },
  admission: {
    initial_state: "submitted",
    states: ["submitted", "shortlisted", "interview", "accepted", "rejected"],
    transitions: [
      { action: "shortlist", from: "submitted",   to: "shortlisted", required_role: "registrar" },
      { action: "interview", from: "shortlisted", to: "interview",   required_role: "registrar" },
      { action: "accept",    from: "interview",   to: "accepted",    required_role: "principal" },
      { action: "reject",    from: "interview",   to: "rejected",    required_role: "principal" },
    ],
  },
};

/* ---------------------------------------------------------------- component */

export function WorkflowViewer() {
  const qc = useQueryClient();
  const role = localStorage.getItem("amis_dev_role") ?? "admin";

  const [fullPayload, setFullPayload] = useState<Record<string, unknown>>({});
  const [workflows, setWorkflows] = useState<Record<string, WorkflowDef>>({});
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<"draft" | "published" | null>(null);

  // New workflow form
  const [showNewWf, setShowNewWf] = useState(false);
  const [newWfKey, setNewWfKey] = useState("");

  // Per-workflow new state/transition inputs
  const [newState, setNewState] = useState<Record<string, string>>({});
const [newTrans, setNewTrans] = useState<Record<string, { action: string; from: string; to: string; required_role: string }>>({});

  const [seededFromDefaults, setSeededFromDefaults] = useState(false);

  useEffect(() => {
    getConfigStatus()
      .then((s) => {
        const p = (s.draft ?? s.published ?? {}) as Record<string, unknown>;
        setFullPayload(p);
        const saved = (p.workflows ?? {}) as Record<string, WorkflowDef>;
        if (Object.keys(saved).length === 0) {
          // Nothing published yet — seed editor from built-in defaults so the
          // admin sees what the system is currently running and can customise it.
          setWorkflows(SEED_WORKFLOWS);
          setSeededFromDefaults(true);
        } else {
          setWorkflows(saved);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  /* ---- workflow mutations ---- */

  function createWorkflow(key: string) {
    const k = key.trim().toLowerCase().replace(/\s+/g, "_");
    if (!k || workflows[k]) return;
    setWorkflows((prev) => ({
      ...prev,
      [k]: { initial_state: "", states: [], transitions: [] },
    }));
    setShowNewWf(false);
    setNewWfKey("");
  }

  function deleteWorkflow(key: string) {
    setWorkflows((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function addState(wfKey: string) {
    const s = (newState[wfKey] ?? "").trim();
    if (!s) return;
    setWorkflows((prev) => {
      const wf = prev[wfKey];
      if (wf.states.includes(s)) return prev;
      const updated = { ...wf, states: [...wf.states, s] };
      if (!updated.initial_state) updated.initial_state = s;
      return { ...prev, [wfKey]: updated };
    });
    setNewState((p) => ({ ...p, [wfKey]: "" }));
  }

  function removeState(wfKey: string, s: string) {
    setWorkflows((prev) => {
      const wf = prev[wfKey];
      const states = wf.states.filter((x) => x !== s);
      const transitions = wf.transitions.filter((t) => t.from !== s && t.to !== s);
      const initial_state = wf.initial_state === s ? (states[0] ?? "") : wf.initial_state;
      return { ...prev, [wfKey]: { ...wf, states, transitions, initial_state } };
    });
  }

  function setInitialState(wfKey: string, s: string) {
    setWorkflows((prev) => ({ ...prev, [wfKey]: { ...prev[wfKey], initial_state: s } }));
  }

  function addTransition(wfKey: string) {
    const t = newTrans[wfKey] ?? { action: "", from: "", to: "", required_role: "" };
    if (!t.action.trim() || !t.from || !t.to) return;
    const entry: WorkflowTransition = { action: t.action.trim(), from: t.from, to: t.to };
    if (t.required_role) entry.required_role = t.required_role;
    setWorkflows((prev) => {
      const wf = prev[wfKey];
      return { ...prev, [wfKey]: { ...wf, transitions: [...wf.transitions, entry] } };
    });
    setNewTrans((p) => ({ ...p, [wfKey]: { action: "", from: "", to: "", required_role: "" } }));
  }

  function removeTransition(wfKey: string, idx: number) {
    setWorkflows((prev) => {
      const wf = prev[wfKey];
      return { ...prev, [wfKey]: { ...wf, transitions: wf.transitions.filter((_, i) => i !== idx) } };
    });
  }

  /* ---- save / publish ---- */

  function buildUpdated() {
    return { ...fullPayload, workflows };
  }

  async function handleSave() {
    setSaving(true); setError(null); setSavedMsg(null);
    try {
      const updated = buildUpdated();
      await createDraft(updated);
      setFullPayload(updated);
      setSavedMsg("draft");
      qc.invalidateQueries({ queryKey: ["config"] });
    } catch {
      setError("Failed to save workflows");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAndPublish() {
    setPublishing(true); setError(null); setSavedMsg(null);
    try {
      const updated = buildUpdated();
      await createDraft(updated);
      await publishConfig(role);
      setFullPayload(updated);
      setSavedMsg("published");
      qc.invalidateQueries({ queryKey: ["config"] });
      qc.invalidateQueries({ queryKey: ["config/status"] });
    } catch {
      setError("Failed to publish workflows");
    } finally {
      setPublishing(false);
    }
  }

  /* ---- render ---- */

  if (loading) return <p style={{ color: "#64748b" }}>Loading…</p>;

  const wfKeys = Object.keys(workflows);

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: "0 0 4px", fontSize: 22, color: "#0f172a" }}>Workflow Editor</h2>
          <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>Define state machines for admissions, approvals, and other processes.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => { setEditMode((v) => !v); setSavedMsg(null); }}
            style={{ padding: "8px 16px", background: editMode ? "#f1f5f9" : "#2563eb", color: editMode ? "#374151" : "#fff", border: "1px solid #d1d5db", borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            {editMode ? "View Mode" : "Edit Mode"}
          </button>
          {editMode && (
            <button
              onClick={() => setShowNewWf(true)}
              style={{ padding: "8px 16px", background: "#0f172a", color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
            >
              + New Workflow
            </button>
          )}
        </div>
      </div>

      {/* Default-seed notice */}
      {seededFromDefaults && (
        <div style={{ background: "#fef9c3", border: "1px solid #fde047", borderRadius: 8, padding: "10px 16px", marginBottom: 20, fontSize: 13, color: "#713f12" }}>
          <strong>Showing built-in defaults.</strong> No workflows have been published yet — the editor is pre-loaded with the system defaults so you can review and customise them. Click <strong>Save &amp; Publish</strong> to make these (or your changes) the active configuration.
        </div>
      )}

      {/* New workflow form */}
      {showNewWf && (
        <div style={{ ...cardStyle, background: "#f8fafc", marginBottom: 20 }}>
          <h4 style={{ margin: "0 0 12px" }}>Create New Workflow</h4>
          <div style={{ display: "flex", gap: 10 }}>
            <input value={newWfKey} onChange={(e) => setNewWfKey(e.target.value)} placeholder="Workflow key, e.g. admission_review" style={{ ...inputSt, width: 300 }} />
            <button onClick={() => createWorkflow(newWfKey)} style={{ padding: "7px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Create</button>
            <button onClick={() => setShowNewWf(false)} style={{ padding: "7px 14px", background: "#fff", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Workflow cards */}
      {wfKeys.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: "center", color: "#94a3b8" }}>
          <p style={{ margin: 0 }}>No workflows defined. {editMode ? 'Click "+ New Workflow" above to create one.' : "Enable Edit Mode to create workflows."}</p>
        </div>
      ) : (
        wfKeys.map((wfKey) => {
          const wf = workflows[wfKey];
          const nt = newTrans[wfKey] ?? { action: "", from: "", to: "", required_role: "" };
          return (
            <div key={wfKey} style={cardStyle}>
              {/* Workflow title row */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 16, color: "#0f172a", fontFamily: "monospace" }}>{wfKey}</h3>
                {editMode && (
                  <button
                    onClick={() => { if (confirm(`Delete workflow "${wfKey}"?`)) deleteWorkflow(wfKey); }}
                    style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
                  >
                    Delete workflow
                  </button>
                )}
              </div>

              {/* Initial state selector */}
              <div style={{ marginBottom: 16 }}>
                <span style={{ fontSize: 13, color: "#64748b" }}>Initial state: </span>
                {editMode ? (
                  <select
                    value={wf.initial_state}
                    onChange={(e) => setInitialState(wfKey, e.target.value)}
                    style={{ ...selectSt, width: 200, display: "inline-block" }}
                  >
                    <option value="">— select —</option>
                    {wf.states.map((s) => <option key={s}>{s}</option>)}
                  </select>
                ) : (
                  <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 4, background: "#dbeafe", color: "#1d4ed8", fontWeight: 600, fontSize: 12 }}>
                    {wf.initial_state || "not set"}
                  </span>
                )}
              </div>

              {/* States section */}
              <h4 style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 8 }}>States</h4>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                {wf.states.map((s) => (
                  <span key={s} style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "3px 10px", borderRadius: 4,
                    background: s === wf.initial_state ? "#dbeafe" : "#f1f5f9",
                    color: s === wf.initial_state ? "#1d4ed8" : "#374151",
                    fontSize: 12, fontWeight: 500, border: "1px solid #e2e8f0",
                  }}>
                    {s}
                    {editMode && s !== wf.initial_state && (
                      <button onClick={() => removeState(wfKey, s)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 12, lineHeight: 1, padding: "0 2px" }}>✕</button>
                    )}
                  </span>
                ))}
              </div>
              {editMode && (
                <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                  <input
                    value={newState[wfKey] ?? ""}
                    onChange={(e) => setNewState((p) => ({ ...p, [wfKey]: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && addState(wfKey)}
                    placeholder="New state name…"
                    style={{ ...inputSt, width: 200 }}
                  />
                  <button onClick={() => addState(wfKey)} style={{ padding: "6px 14px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Add State</button>
                </div>
              )}

              {/* Transitions */}
              <h4 style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 8 }}>Transitions</h4>
              {wf.transitions.length === 0 ? (
                <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 12 }}>No transitions defined.</p>
              ) : (
                <table style={{ borderCollapse: "collapse", width: "100%", marginBottom: 12 }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Action</th>
                      <th style={thStyle}>From</th>
                      <th style={thStyle}>To</th>
                      <th style={thStyle}>Required role</th>
                      {editMode && <th style={thStyle}></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {wf.transitions.map((t, i) => (
                      <tr key={i}>
                        <td style={tdStyle}><code style={{ fontFamily: "monospace", fontSize: 12, background: "#f8fafc", padding: "1px 6px", borderRadius: 3 }}>{t.action}</code></td>
                        <td style={tdStyle}>{t.from}</td>
                        <td style={tdStyle}>{t.to}</td>
                        <td style={tdStyle}>
                          {t.required_role ? (
                            <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 4, background: "#ede9fe", color: "#6d28d9", fontSize: 11, fontWeight: 600 }}>
                              {t.required_role}
                            </span>
                          ) : (
                            <span style={{ color: "#94a3b8", fontSize: 12 }}>any</span>
                          )}
                        </td>
                        {editMode && (
                          <td style={tdStyle}>
                            <button onClick={() => removeTransition(wfKey, i)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 14 }}>✕</button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {editMode && (
                <div style={{ display: "flex", gap: 10, alignItems: "flex-end", padding: "12px 14px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0", flexWrap: "wrap" }}>
                  <div style={{ flex: 2, minWidth: 120 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 3 }}>Action</div>
                    <input value={nt.action} onChange={(e) => setNewTrans((p) => ({ ...p, [wfKey]: { ...nt, action: e.target.value } }))} placeholder="e.g. verify_payment" style={inputSt} />
                  </div>
                  <div style={{ flex: 2, minWidth: 120 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 3 }}>From</div>
                    <select value={nt.from} onChange={(e) => setNewTrans((p) => ({ ...p, [wfKey]: { ...nt, from: e.target.value } }))} style={selectSt}>
                      <option value="">Select…</option>
                      {wf.states.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 2, minWidth: 120 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 3 }}>To</div>
                    <select value={nt.to} onChange={(e) => setNewTrans((p) => ({ ...p, [wfKey]: { ...nt, to: e.target.value } }))} style={selectSt}>
                      <option value="">Select…</option>
                      {wf.states.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 2, minWidth: 120 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 3 }}>Required role</div>
                    <select value={nt.required_role ?? ""} onChange={(e) => setNewTrans((p) => ({ ...p, [wfKey]: { ...nt, required_role: e.target.value } }))} style={selectSt}>
                      <option value="">any role</option>
                      {ROLES.map((r) => <option key={r}>{r}</option>)}
                    </select>
                  </div>
                  <button onClick={() => addTransition(wfKey)} style={{ padding: "8px 16px", background: "#0f172a", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                    + Add
                  </button>
                </div>
              )}
            </div>
          );
        })
      )}

      {/* Save / Publish buttons (only in edit mode) */}
      {editMode && (
        <>
          {error && <div style={{ padding: "10px 16px", background: "#fee2e2", color: "#dc2626", borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{error}</div>}
          {savedMsg && (
            <div style={{ padding: "10px 16px", background: "#dcfce7", color: "#15803d", borderRadius: 8, marginBottom: 12, fontSize: 13, fontWeight: 600 }}>
              {savedMsg === "draft" ? "✓ Saved as draft." : "✓ Published!"}
            </div>
          )}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={handleSave} disabled={saving || publishing} style={{ padding: "10px 22px", background: saving ? "#93c5fd" : "#2563eb", color: "#fff", border: "none", borderRadius: 7, fontSize: 14, fontWeight: 700, cursor: saving || publishing ? "not-allowed" : "pointer" }}>
              {saving ? "Saving…" : "Save as Draft"}
            </button>
            <button onClick={handleSaveAndPublish} disabled={saving || publishing} style={{ padding: "10px 22px", background: publishing ? "#4ade80" : "#16a34a", color: "#fff", border: "none", borderRadius: 7, fontSize: 14, fontWeight: 700, cursor: saving || publishing ? "not-allowed" : "pointer" }}>
              {publishing ? "Publishing…" : "Save & Publish"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
