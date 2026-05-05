import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getStudentProject,
  getProjectCosting,
  updateStudentProject,
  type ProjectStatus,
} from "./student-projects.api";
import {
  ensureGlobalCss,
  PageHeader,
  Card,
  DetailRow,
  Badge,
  PrimaryBtn,
  SecondaryBtn,
  ErrorBanner,
  SectionLabel,
  Spinner,
  Field,
  inputCss,
  C,
  DataTable,
  TR,
  TD,
} from "../../lib/ui";

const PROJECT_STATUSES: ProjectStatus[] = [
  "draft",
  "active",
  "submitted",
  "assessed",
];

type BadgeColor = "gray" | "blue" | "yellow" | "green";
const STATUS_BADGE: Record<ProjectStatus, BadgeColor> = {
  draft: "gray",
  active: "blue",
  submitted: "yellow",
  assessed: "green",
};

export function StudentProjectDetailPage() {
  ensureGlobalCss();
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const [tab, setTab] = useState<"details" | "costing">("details");
  const [editing, setEditing] = useState(false);
  const [patchError, setPatchError] = useState<string | null>(null);
  const [form, setForm] = useState<{
    project_title: string;
    description: string;
    status: ProjectStatus;
  } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["studentProject", id],
    queryFn: () => getStudentProject(id!),
    enabled: !!id,
  });

  const { data: costing, isLoading: costingLoading } = useQuery({
    queryKey: ["projectCosting", id],
    queryFn: () => getProjectCosting(id!),
    enabled: tab === "costing" && !!id,
  });

  const patchMut = useMutation({
    mutationFn: () =>
      updateStudentProject(id!, {
        project_title: form!.project_title || undefined,
        description: form!.description || null,
        status: form!.status,
      }),
    onSuccess: () => {
      setPatchError(null);
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["studentProject", id] });
      qc.invalidateQueries({ queryKey: ["studentProjects"] });
    },
    onError: (err) =>
      setPatchError(err instanceof Error ? err.message : "Update failed"),
  });

  function startEdit() {
    if (!data) return;
    setForm({
      project_title: data.project_title,
      description: data.description ?? "",
      status: data.status,
    });
    setEditing(true);
  }

  if (isLoading) return <Spinner />;
  if (!data)
    return (
      <div>
        <PageHeader
          title="Student Project"
          back={{ label: "Student Projects", to: "/student-projects" }}
        />
        <ErrorBanner message="Project not found." />
      </div>
    );

  return (
    <div>
      <PageHeader
        title={data.project_title}
        back={{ label: "Student Projects", to: "/student-projects" }}
        action={<Badge label={data.status} color={STATUS_BADGE[data.status]} />}
      />

      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          gap: 0,
          borderBottom: `2px solid ${C.gray200}`,
          marginBottom: 20,
        }}
      >
        {(["details", "costing"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              background: "none",
              border: "none",
              padding: "10px 20px",
              fontWeight: tab === t ? 600 : 400,
              color: tab === t ? C.primary : C.gray500,
              borderBottom:
                tab === t
                  ? `2px solid ${C.primary}`
                  : "2px solid transparent",
              marginBottom: -2,
              cursor: "pointer",
              fontSize: 14,
              textTransform: "capitalize",
            }}
          >
            {t === "costing" ? "RLP Costing" : "Details"}
          </button>
        ))}
      </div>

      {/* Details tab */}
      {tab === "details" && !editing && (
        <Card padding="0 24px" style={{ marginBottom: 20 }}>
          <DetailRow label="Student">
            {data.student_name ?? data.student_id}
          </DetailRow>
          <DetailRow label="Project Title">{data.project_title}</DetailRow>
          <DetailRow label="Description">{data.description ?? "—"}</DetailRow>
          <DetailRow label="Status">
            <Badge label={data.status} color={STATUS_BADGE[data.status]} />
          </DetailRow>
          <DetailRow label="Term">{data.term_id ?? "—"}</DetailRow>
          <DetailRow label="Course">{data.course_id ?? "—"}</DetailRow>
          <DetailRow label="Created">
            {new Date(data.created_at).toLocaleString()}
          </DetailRow>
          <div style={{ padding: "16px 0" }}>
            <SecondaryBtn onClick={startEdit}>Edit</SecondaryBtn>
          </div>
        </Card>
      )}

      {tab === "details" && editing && (
        <Card padding="20px 24px" style={{ marginBottom: 20 }}>
          <SectionLabel>Edit Project</SectionLabel>
          {patchError && <ErrorBanner message={patchError} />}
          <Field label="Project Title" required>
            <input
              style={inputCss}
              value={form!.project_title}
              onChange={(e) =>
                setForm((f) => f && { ...f, project_title: e.target.value })
              }
            />
          </Field>
          <Field label="Description">
            <textarea
              style={{ ...inputCss, minHeight: 80, resize: "vertical" }}
              value={form!.description}
              onChange={(e) =>
                setForm((f) => f && { ...f, description: e.target.value })
              }
            />
          </Field>
          <Field label="Status">
            <select
              style={inputCss}
              value={form!.status}
              onChange={(e) =>
                setForm(
                  (f) => f && { ...f, status: e.target.value as ProjectStatus },
                )
              }
            >
              {PROJECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </Field>
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <PrimaryBtn
              onClick={() => patchMut.mutate()}
              disabled={patchMut.isPending}
            >
              {patchMut.isPending ? "Saving…" : "Save Changes"}
            </PrimaryBtn>
            <SecondaryBtn onClick={() => setEditing(false)}>Cancel</SecondaryBtn>
          </div>
        </Card>
      )}

      {/* Issuances */}
      {tab === "details" && (
        <Card style={{ marginBottom: 20 }}>
          <div style={{ padding: "16px 24px 12px", borderBottom: `1px solid ${C.gray100}` }}>
            <SectionLabel>
              Store Issuances ({data.issuances?.length ?? 0})
            </SectionLabel>
          </div>
          {!data.issuances?.length ? (
            <p style={{ padding: "16px 24px", color: C.gray400, fontSize: 14, margin: 0 }}>
              No store issuances linked to this project.
            </p>
          ) : (
            data.issuances.map((iss) => (
              <div
                key={iss.id}
                style={{
                  padding: "12px 24px",
                  borderBottom: `1px solid ${C.gray100}`,
                }}
              >
                <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 4 }}>
                  {new Date(iss.issued_at).toLocaleDateString()}
                  {iss.notes && (
                    <span style={{ color: C.gray400, fontWeight: 400, marginLeft: 8 }}>
                      — {iss.notes}
                    </span>
                  )}
                </div>
                {iss.items?.map((item, i) => (
                  <div key={i} style={{ fontSize: 13, color: C.gray600 }}>
                    {item.item_name} × {item.quantity} {item.unit}
                  </div>
                ))}
              </div>
            ))
          )}
        </Card>
      )}

      {/* Costing tab */}
      {tab === "costing" && (
        <>
          {costingLoading ? (
            <Spinner />
          ) : !costing ? (
            <ErrorBanner message="Failed to load costing data." />
          ) : (
            <>
              {/* Print button */}
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
                <SecondaryBtn onClick={() => window.print()}>
                  🖨 Print
                </SecondaryBtn>
              </div>

              <Card style={{ marginBottom: 20 }}>
                <div
                  style={{
                    padding: "16px 24px",
                    borderBottom: `1px solid ${C.gray100}`,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <SectionLabel>RLP Costing Report</SectionLabel>
                    <p style={{ margin: "4px 0 0", fontSize: 13, color: C.gray500 }}>
                      {costing.project_title}
                    </p>
                  </div>
                </div>

                <DataTable
                  headers={["Item", "Unit", "Qty", "Unit Cost (MWK)", "Line Total (MWK)"]}
                  isLoading={false}
                  isEmpty={!costing.line_items?.length}
                  emptyIcon="📦"
                  emptyTitle="No items yet"
                  emptyDescription="Link store issuances to this project to generate a costing report."
                  colCount={5}
                >
                  {costing.line_items?.map((line, i) => (
                    <TR key={i}>
                      <TD>{line.item_name}</TD>
                      <TD muted>{line.unit}</TD>
                      <TD muted>{line.total_qty}</TD>
                      <TD muted>{Number(line.unit_cost).toLocaleString()}</TD>
                      <TD>
                        <span style={{ fontWeight: 600 }}>
                          {Number(line.line_total).toLocaleString()}
                        </span>
                      </TD>
                    </TR>
                  ))}
                </DataTable>

                {costing.line_items?.length > 0 && (
                  <div
                    style={{
                      padding: "16px 24px",
                      borderTop: `2px solid ${C.gray200}`,
                      display: "flex",
                      justifyContent: "flex-end",
                      alignItems: "center",
                      gap: 16,
                    }}
                  >
                    <span style={{ fontSize: 14, color: C.gray500, fontWeight: 600 }}>
                      GRAND TOTAL
                    </span>
                    <span
                      style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: C.gray900,
                      }}
                    >
                      MWK {Number(costing.grand_total).toLocaleString()}
                    </span>
                  </div>
                )}
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
