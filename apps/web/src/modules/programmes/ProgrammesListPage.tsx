import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { listProgrammes, deleteProgramme, createProgramme, updateProgramme, type CreateProgrammeBody, type Programme } from "./programmes.api";
import { useConfig } from "../../app/ConfigProvider";
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
  selectCss,
  C,
} from "../../lib/ui";

const PROGRAMME_LEVELS = [
  "Certificate",
  "National Certificate",
  "National Diploma",
  "Higher National Diploma",
  "Diploma",
  "Bachelor's Degree",
] as const;

const FALLBACK_DEPARTMENTS = [
  "ICT", "Business", "Engineering", "Education", "Health Sciences",
  "Agriculture", "Social Sciences", "Hospitality", "Construction",
  "Automotive", "Electrical", "Others",
];

/* ── Uganda TVET Standard Programme Catalogue ── */
interface CatalogueEntry {
  code: string;
  title: string;
  level: string;
  duration_months: number;
  department: string;
}
const TVET_CATALOGUE: CatalogueEntry[] = [
  // National Certificates
  { code: "NCBC", title: "National Certificate in Building Construction", level: "National Certificate", duration_months: 12, department: "Construction" },
  { code: "NCES", title: "National Certificate in Electrical Studies", level: "National Certificate", duration_months: 12, department: "Electrical" },
  { code: "NCMS", title: "National Certificate in Motor Vehicle Studies", level: "National Certificate", duration_months: 12, department: "Automotive" },
  { code: "NCIT", title: "National Certificate in Information Technology", level: "National Certificate", duration_months: 12, department: "ICT" },
  { code: "NCBS", title: "National Certificate in Business Studies", level: "National Certificate", duration_months: 12, department: "Business" },
  { code: "NCHM", title: "National Certificate in Hotel and Restaurant Management", level: "National Certificate", duration_months: 12, department: "Hospitality" },
  { code: "NCFC", title: "National Certificate in Food and Catering", level: "National Certificate", duration_months: 12, department: "Hospitality" },
  { code: "NCAG", title: "National Certificate in Agriculture", level: "National Certificate", duration_months: 12, department: "Agriculture" },
  { code: "NCPB", title: "National Certificate in Plumbing and Pipe Fitting", level: "National Certificate", duration_months: 12, department: "Engineering" },
  { code: "NCWE", title: "National Certificate in Welding and Fabrication", level: "National Certificate", duration_months: 12, department: "Engineering" },
  { code: "NCFT", title: "National Certificate in Fashion and Garment Design", level: "National Certificate", duration_months: 12, department: "Others" },
  { code: "NCHSC", title: "National Certificate in Health and Social Care", level: "National Certificate", duration_months: 12, department: "Health Sciences" },
  { code: "NCPM", title: "National Certificate in Production and Manufacturing", level: "National Certificate", duration_months: 12, department: "Engineering" },
  { code: "NCRF", title: "National Certificate in Refrigeration and Air Conditioning", level: "National Certificate", duration_months: 12, department: "Electrical" },
  { code: "NCCA", title: "National Certificate in Computer Applications", level: "National Certificate", duration_months: 12, department: "ICT" },
  { code: "NCSC", title: "National Certificate in Secretarial Studies", level: "National Certificate", duration_months: 12, department: "Business" },
  { code: "NCAC", title: "National Certificate in Accounting", level: "National Certificate", duration_months: 12, department: "Business" },
  { code: "NCCS", title: "National Certificate in Community Services", level: "National Certificate", duration_months: 12, department: "Social Sciences" },
  // National Diplomas
  { code: "NDBC", title: "National Diploma in Building Construction", level: "National Diploma", duration_months: 24, department: "Construction" },
  { code: "NDES", title: "National Diploma in Electrical Studies", level: "National Diploma", duration_months: 24, department: "Electrical" },
  { code: "NDMS", title: "National Diploma in Motor Vehicle Studies", level: "National Diploma", duration_months: 24, department: "Automotive" },
  { code: "NDIT", title: "National Diploma in Information Technology", level: "National Diploma", duration_months: 24, department: "ICT" },
  { code: "NDBS", title: "National Diploma in Business Studies", level: "National Diploma", duration_months: 24, department: "Business" },
  { code: "NDHM", title: "National Diploma in Hotel and Restaurant Management", level: "National Diploma", duration_months: 24, department: "Hospitality" },
  { code: "NDAG", title: "National Diploma in Agriculture", level: "National Diploma", duration_months: 24, department: "Agriculture" },
  { code: "NDAC", title: "National Diploma in Accounting", level: "National Diploma", duration_months: 24, department: "Business" },
  // Higher National Diplomas
  { code: "HNDBC", title: "Higher National Diploma in Building Construction", level: "Higher National Diploma", duration_months: 36, department: "Construction" },
  { code: "HNDIT", title: "Higher National Diploma in Information Technology", level: "Higher National Diploma", duration_months: 36, department: "ICT" },
  { code: "HNDBS", title: "Higher National Diploma in Business Studies", level: "Higher National Diploma", duration_months: 36, department: "Business" },
  { code: "HNDAS", title: "Higher National Diploma in Accounting Studies", level: "Higher National Diploma", duration_months: 36, department: "Business" },
  { code: "HNDES", title: "Higher National Diploma in Electrical Studies", level: "Higher National Diploma", duration_months: 36, department: "Electrical" },
  // Certificates
  { code: "CBET1", title: "CBET Level 1 Certificate", level: "Certificate", duration_months: 6, department: "Others" },
  { code: "CBET2", title: "CBET Level 2 Certificate", level: "Certificate", duration_months: 12, department: "Others" },
  { code: "CBET3", title: "CBET Level 3 Certificate", level: "Certificate", duration_months: 18, department: "Others" },
];

/* ── Catalogue Modal ── */
function CatalogueModal({ onSelect, onClose }: { onSelect: (e: CatalogueEntry) => void; onClose: () => void }) {
  const [search, setSearch] = useState("");
  const filtered = TVET_CATALOGUE.filter(
    (e) => !search || e.code.toLowerCase().includes(search.toLowerCase()) || e.title.toLowerCase().includes(search.toLowerCase()) || e.department.toLowerCase().includes(search.toLowerCase())
  );
  const overlay: React.CSSProperties = {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 110,
  };
  const modal: React.CSSProperties = {
    background: "#fff", borderRadius: 10, padding: 24, width: "100%", maxWidth: 620,
    maxHeight: "80vh", display: "flex", flexDirection: "column",
    boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
  };
  return (
    <div style={overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={modal}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>TVET Programme Catalogue</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: C.gray500 }}>×</button>
        </div>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: C.gray500 }}>
          Select a standard Uganda TVET programme to pre-fill the form. You can edit the details before saving.
        </p>
        <input
          style={{ ...inputCss, marginBottom: 12 }}
          placeholder="Search by code, title or department…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
        <div style={{ overflowY: "auto", flex: 1, border: "1px solid #e5e7eb", borderRadius: 6 }}>
          {filtered.length === 0 && (
            <div style={{ padding: 24, textAlign: "center", color: C.gray500, fontSize: 13 }}>No programmes match your search.</div>
          )}
          {filtered.map((entry) => (
            <button key={entry.code} type="button"
              style={{
                display: "grid", gridTemplateColumns: "80px 1fr auto", gap: "4px 12px", alignItems: "center",
                width: "100%", padding: "10px 14px", background: "none", border: "none", borderBottom: "1px solid #f3f4f6",
                cursor: "pointer", textAlign: "left",
              }}
              onClick={() => onSelect(entry)}
              onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#f0f9ff"; }}
              onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
            >
              <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 13, color: C.brand600 ?? "#2563eb" }}>{entry.code}</span>
              <span>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{entry.title}</span>
                <span style={{ fontSize: 12, color: C.gray500, marginLeft: 8 }}>{entry.department}</span>
              </span>
              <span style={{ fontSize: 11, color: C.gray400, whiteSpace: "nowrap" }}>{entry.level} · {entry.duration_months} mo</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProgrammeModal({
  programme,
  prefill,
  onClose,
  onSaved,
}: {
  programme: Programme | null;
  prefill?: CatalogueEntry;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = programme !== null;
  const { departments } = useConfig();
  const deptOptions = departments.length > 0 ? departments : FALLBACK_DEPARTMENTS;
  const [form, setForm] = useState({
    code: programme?.code ?? prefill?.code ?? "",
    title: programme?.title ?? prefill?.title ?? "",
    department: programme?.department ?? prefill?.department ?? "",
    duration_months: programme?.duration_months != null ? String(programme.duration_months) : prefill?.duration_months != null ? String(prefill.duration_months) : "",
    duration_unit: (programme?.duration_unit ?? "months") as "months" | "years",
    level: programme?.level ?? prefill?.level ?? "",
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
        duration_unit: form.duration_unit,
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
              <select style={selectCss} value={form.level} onChange={(e) => set("level", e.target.value)}>
                <option value="">— Select level —</option>
                {PROGRAMME_LEVELS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Title" required>
            <input required style={inputCss} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Full programme name" />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Department">
              <select style={selectCss} value={form.department} onChange={(e) => set("department", e.target.value)}>
                <option value="">— Select department —</option>
                {deptOptions.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </Field>
            <Field label="Duration">
              <div style={{ display: "flex", gap: 6 }}>
                <input type="number" min={1} style={{ ...inputCss, flex: 1 }} value={form.duration_months} onChange={(e) => set("duration_months", e.target.value)} placeholder="e.g. 2" />
                <select style={{ ...selectCss, width: 100 }} value={form.duration_unit} onChange={(e) => set("duration_unit", e.target.value)}>
                  <option value="months">Months</option>
                  <option value="years">Years</option>
                </select>
              </div>
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
  const [cataloguePrefill, setCataloguePrefill] = useState<CatalogueEntry | undefined>(undefined);
  const [showCatalogue, setShowCatalogue] = useState(false);
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
          <div style={{ display: "flex", gap: 8 }}>
            <SecondaryBtn onClick={() => setShowCatalogue(true)}>📋 Browse TVET Catalogue</SecondaryBtn>
            <PrimaryBtn onClick={() => { setCataloguePrefill(undefined); setModalProg(null); }}>+ New Programme</PrimaryBtn>
          </div>
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
            <TD>{p.duration_months != null ? `${p.duration_months} ${p.duration_unit === "years" ? "yr" : "mo"}` : "—"}</TD>
            <TD>{p.level ?? "—"}</TD>
            <TD><Badge label={p.is_active ? "Active" : "Inactive"} color={p.is_active ? "green" : "gray"} /></TD>
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
          prefill={cataloguePrefill}
          onClose={() => { setModalProg(undefined); setCataloguePrefill(undefined); }}
          onSaved={() => qc.invalidateQueries({ queryKey: ["programmes"] })}
        />
      )}
      {showCatalogue && (
        <CatalogueModal
          onClose={() => setShowCatalogue(false)}
          onSelect={(entry) => {
            setCataloguePrefill(entry);
            setModalProg(null);
            setShowCatalogue(false);
          }}
        />
      )}
    </div>
  );
}
