import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { listProgrammes, deleteProgramme, createProgramme, updateProgramme, type CreateProgrammeBody, type Programme } from "./programmes.api";
import {
  ensureGlobalCss,
  PageHeader,
  FilterBar,
  SearchInput,
  DataTable,
  TR,
  TD,
  Badge,
  PrimaryBtn,
  SecondaryBtn,
  ErrorBanner,
  Card,
  Field,
  inputCss,
  C,
} from "../../lib/ui";

function ProgrammeModal({
  programme,
  onClose,
  onSaved,
}: {
  programme: Programme | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = programme !== null;
  const [form, setForm] = useState({
    code: programme?.code ?? "",
    title: programme?.title ?? "",
    department: programme?.department ?? "",
    duration_months: programme?.duration_months != null ? String(programme.duration_months) : "",
    level: programme?.level ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body: CreateProgrammeBody = {
        code: form.code,
        title: form.title,
        department: form.department || undefined,
        duration_months: form.duration_months ? Number(form.duration_months) : undefined,
        level: form.level || undefined,
      };
      if (isEdit) {
        await updateProgramme(programme!.id, body);
      } else {
        await createProgramme(body);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const overlay: React.CSSProperties = {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
  };
  const modal: React.CSSProperties = {
    background: "#fff", borderRadius: 10, padding: 28, width: "100%", maxWidth: 480,
    boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
  };

  return (
    <div style={overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={modal}>
        <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 600 }}>
          {isEdit ? "Edit Programme" : "New Programme"}
        </h2>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Code" required>
              <input required style={inputCss} value={form.code} onChange={(e) => set("code", e.target.value)} placeholder="e.g. NCBC" />
            </Field>
            <Field label="Level">
              <input style={inputCss} value={form.level} onChange={(e) => set("level", e.target.value)} placeholder="e.g. Certificate" />
            </Field>
          </div>
          <Field label="Title" required>
            <input required style={inputCss} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Full programme name" />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Department">
              <input style={inputCss} value={form.department} onChange={(e) => set("department", e.target.value)} placeholder="e.g. ICT" />
            </Field>
            <Field label="Duration (months)">
              <input type="number" min={1} style={inputCss} value={form.duration_months} onChange={(e) => set("duration_months", e.target.value)} placeholder="e.g. 12" />
            </Field>
          </div>
          {error && <ErrorBanner message={error} />}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
            <SecondaryBtn type="button" onClick={onClose}>Cancel</SecondaryBtn>
            <PrimaryBtn type="submit" disabled={saving}>{saving ? "Saving…" : isEdit ? "Save Changes" : "Create"}</PrimaryBtn>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ProgrammesListPage() {
  ensureGlobalCss();
  const [params, setParams] = useSearchParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const search = params.get("search") ?? "";
  const showInactive = params.get("inactive") === "true";

  const [modalProg, setModalProg] = useState<Programme | null | undefined>(undefined);
  // undefined = closed, null = new, Programme = edit

  function setSearch(v: string) {
    setParams((p) => { const n = new URLSearchParams(p); n.set("search", v); n.set("page", "1"); return n; });
  }

  function toggleInactive() {
    setParams((p) => { const n = new URLSearchParams(p); n.set("inactive", showInactive ? "false" : "true"); return n; });
  }

  const { data: programmes, isLoading, error } = useQuery({
    queryKey: ["programmes", { search, showInactive }],
    queryFn: () => listProgrammes({ search: search || undefined, include_inactive: showInactive || undefined }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteProgramme(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["programmes"] }),
  });

  function handleDelete(prog: Programme) {
    if (!confirm(`Deactivate "${prog.code} — ${prog.title}"?`)) return;
    deleteMutation.mutate(prog.id);
  }

  const isEmpty = !isLoading && !error && (programmes?.length ?? 0) === 0;

  return (
    <div>
      <PageHeader
        title="Programme Catalog"
        action={
          <PrimaryBtn onClick={() => setModalProg(null)}>+ New Programme</PrimaryBtn>
        }
      />

      {error && <ErrorBanner message="Failed to load programmes." />}

      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search by code or title…" />
        <button
          onClick={toggleInactive}
          style={{
            padding: "7px 14px", border: "1px solid #d1d5db", borderRadius: 6,
            fontSize: 13, background: showInactive ? "#f3f4f6" : "white",
            cursor: "pointer", fontWeight: showInactive ? 600 : 400,
          }}
        >
          {showInactive ? "Hide inactive" : "Show inactive"}
        </button>
      </FilterBar>

      <DataTable
        headers={["Code", "Title", "Department", "Duration", "Level", "Status", ""]}
        isLoading={isLoading}
        isEmpty={isEmpty}
        emptyIcon="📚"
        emptyTitle={search ? "No programmes match your search" : "No programmes yet"}
        emptyDescription={search ? "Try a different search term." : 'Click "+ New Programme" to add one.'}
        colCount={7}
      >
        {programmes?.map((p) => (
          <TR key={p.id} onClick={() => navigate(`/programmes/${p.id}`)}>
            <TD><strong style={{ fontFamily: "monospace" }}>{p.code}</strong></TD>
            <TD>{p.title}</TD>
            <TD>{p.department ?? "—"}</TD>
            <TD>{p.duration_months != null ? `${p.duration_months} mo` : "—"}</TD>
            <TD>{p.level ?? "—"}</TD>
            <TD><Badge variant={p.is_active ? "green" : "gray"}>{p.is_active ? "Active" : "Inactive"}</Badge></TD>
            <TD>
              <div style={{ display: "flex", gap: 8 }} onClick={(e) => e.stopPropagation()}>
                <SecondaryBtn onClick={() => setModalProg(p)} style={{ padding: "4px 10px", fontSize: 12 }}>Edit</SecondaryBtn>
                {p.is_active && (
                  <button
                    onClick={() => handleDelete(p)}
                    style={{ padding: "4px 10px", fontSize: 12, border: "1px solid #fca5a5", borderRadius: 6, background: "#fff", color: C.red, cursor: "pointer" }}
                  >
                    Deactivate
                  </button>
                )}
              </div>
            </TD>
          </TR>
        ))}
      </DataTable>

      {modalProg !== undefined && (
        <ProgrammeModal
          programme={modalProg}
          onClose={() => setModalProg(undefined)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["programmes"] })}
        />
      )}
    </div>
  );
}
