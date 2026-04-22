import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getProgramme, updateProgramme, deleteProgramme, type UpdateProgrammeBody } from "./programmes.api";
import {
  ensureGlobalCss,
  Spinner,
  PageHeader,
  Card,
  DetailRow,
  Badge,
  PrimaryBtn,
  SecondaryBtn,
  ErrorBanner,
  SectionLabel,
  Field,
  inputCss,
  C,
} from "../../lib/ui";

export function ProgrammeDetailPage() {
  ensureGlobalCss();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    code: "",
    title: "",
    department: "",
    duration_months: "",
    level: "",
  });

  const { data: programme, isLoading, error } = useQuery({
    queryKey: ["programmes", id],
    queryFn: () => getProgramme(id!),
    enabled: !!id,
  });

  const saveMutation = useMutation({
    mutationFn: (body: UpdateProgrammeBody) => updateProgramme(id!, body),
    onSuccess: (updated) => {
      qc.setQueryData(["programmes", id], updated);
      qc.invalidateQueries({ queryKey: ["programmes"] });
      setEditing(false);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: () => deleteProgramme(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["programmes"] });
      navigate("/programmes");
    },
  });

  function startEdit() {
    setForm({
      code: programme!.code,
      title: programme!.title,
      department: programme!.department ?? "",
      duration_months: programme!.duration_months != null ? String(programme!.duration_months) : "",
      level: programme!.level ?? "",
    });
    setEditing(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body: UpdateProgrammeBody = {
      code: form.code,
      title: form.title,
      department: form.department || undefined,
      duration_months: form.duration_months ? Number(form.duration_months) : undefined,
      level: form.level || undefined,
    };
    saveMutation.mutate(body);
  }

  if (isLoading) return <Spinner />;
  if (error || !programme) return <ErrorBanner message="Programme not found." />;

  return (
    <div>
      <PageHeader
        title={`${programme.code} — ${programme.title}`}
        back={{ label: "Programmes", to: "/programmes" }}
        action={
          !editing ? (
            <div style={{ display: "flex", gap: 10 }}>
              <SecondaryBtn onClick={startEdit}>Edit</SecondaryBtn>
              {programme.is_active && (
                <button
                  onClick={() => {
                    if (confirm(`Deactivate "${programme.code}"?`)) deactivateMutation.mutate();
                  }}
                  style={{
                    padding: "7px 14px", fontSize: 13, borderRadius: 6,
                    border: "1px solid #fca5a5", background: "#fff", color: C.red, cursor: "pointer",
                  }}
                >
                  Deactivate
                </button>
              )}
            </div>
          ) : undefined
        }
      />

      {editing ? (
        <Card padding="24px" style={{ maxWidth: 520 }}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <SectionLabel>Edit Programme</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Code" required>
                <input required style={inputCss} value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
              </Field>
              <Field label="Level">
                <input style={inputCss} value={form.level} onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))} />
              </Field>
            </div>
            <Field label="Title" required>
              <input required style={inputCss} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Department">
                <input style={inputCss} value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} />
              </Field>
              <Field label="Duration (months)">
                <input type="number" min={1} style={inputCss} value={form.duration_months} onChange={(e) => setForm((f) => ({ ...f, duration_months: e.target.value }))} />
              </Field>
            </div>
            {saveMutation.isError && <ErrorBanner message="Failed to save." />}
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <PrimaryBtn type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving…" : "Save Changes"}
              </PrimaryBtn>
              <SecondaryBtn type="button" onClick={() => setEditing(false)}>Cancel</SecondaryBtn>
            </div>
          </form>
        </Card>
      ) : (
        <Card padding="24px" style={{ maxWidth: 520 }}>
          <SectionLabel>Details</SectionLabel>
          <DetailRow label="Code">{programme.code}</DetailRow>
          <DetailRow label="Title">{programme.title}</DetailRow>
          <DetailRow label="Department">{programme.department ?? "—"}</DetailRow>
          <DetailRow label="Duration">{programme.duration_months != null ? `${programme.duration_months} months` : "—"}</DetailRow>
          <DetailRow label="Level">{programme.level ?? "—"}</DetailRow>
          <DetailRow label="Status">
            <Badge label={programme.is_active ? "Active" : "Inactive"} color={programme.is_active ? "green" : "gray"} />
          </DetailRow>
          <DetailRow label="Created">{new Date(programme.created_at).toLocaleDateString()}</DetailRow>
        </Card>
      )}
    </div>
  );
}
