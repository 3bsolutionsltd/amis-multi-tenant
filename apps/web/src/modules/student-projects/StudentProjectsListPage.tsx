import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listStudentProjects,
  createStudentProject,
  type ProjectStatus,
} from "./student-projects.api";
import { StudentPickerInput } from "../../lib/StudentPickerInput";
import {
  ensureGlobalCss,
  PageHeader,
  Card,
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

export function StudentProjectsListPage() {
  ensureGlobalCss();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "">("");
  const [showCreate, setShowCreate] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [form, setForm] = useState({
    student_id: "",
    student_name: "",
    project_title: "",
    description: "",
    status: "draft" as ProjectStatus,
  });

  const params = statusFilter ? { status: statusFilter } : undefined;

  const { data, isLoading } = useQuery({
    queryKey: ["studentProjects", statusFilter],
    queryFn: () => listStudentProjects(params),
  });

  const createMut = useMutation({
    mutationFn: () =>
      createStudentProject({
        student_id: form.student_id,
        project_title: form.project_title,
        description: form.description || undefined,
        status: form.status,
      }),
    onSuccess: (created) => {
      setCreateError(null);
      setShowCreate(false);
      setForm({ student_id: "", student_name: "", project_title: "", description: "", status: "draft" });
      qc.invalidateQueries({ queryKey: ["studentProjects"] });
      navigate(`/student-projects/${created.id}`);
    },
    onError: (err) => setCreateError(err instanceof Error ? err.message : "Failed"),
  });

  return (
    <div>
      <PageHeader
        title="Student Projects"
        action={
          <PrimaryBtn onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? "Cancel" : "+ New Project"}
          </PrimaryBtn>
        }
      />

      {/* Create form */}
      {showCreate && (
        <Card padding="20px 24px" style={{ marginBottom: 20 }}>
          <SectionLabel>New Project</SectionLabel>
          {createError && <ErrorBanner message={createError} />}
          <Field label="Student" required>
            <StudentPickerInput
              value={form.student_id}
              displayName={form.student_name}
              onChange={(id, name) => setForm((f) => ({ ...f, student_id: id, student_name: name }))}
            />
          </Field>
          <Field label="Project Title" required>
            <input
              style={inputCss}
              value={form.project_title}
              onChange={(e) => setForm((f) => ({ ...f, project_title: e.target.value }))}
            />
          </Field>
          <Field label="Description">
            <textarea
              style={{ ...inputCss, minHeight: 60, resize: "vertical" }}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </Field>
          <Field label="Status">
            <select
              style={inputCss}
              value={form.status}
              onChange={(e) =>
                setForm((f) => ({ ...f, status: e.target.value as ProjectStatus }))
              }
            >
              {PROJECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </Field>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <PrimaryBtn
              onClick={() => createMut.mutate()}
              disabled={
                !form.student_id.trim() ||
                !form.project_title.trim() ||
                createMut.isPending
              }
            >
              {createMut.isPending ? "Creating…" : "Create Project"}
            </PrimaryBtn>
            <SecondaryBtn onClick={() => setShowCreate(false)}>Cancel</SecondaryBtn>
          </div>
        </Card>
      )}

      {/* Filter */}
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: 13, color: C.gray500 }}>Filter by status:</span>
        {["", ...PROJECT_STATUSES].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s as ProjectStatus | "")}
            style={{
              fontSize: 12,
              fontWeight: statusFilter === s ? 700 : 400,
              color: statusFilter === s ? C.primary : C.gray500,
              background: statusFilter === s ? C.blueBg : "none",
              border: `1px solid ${statusFilter === s ? C.primary : C.gray200}`,
              borderRadius: 6,
              padding: "3px 10px",
              cursor: "pointer",
            }}
          >
            {s === "" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      <Card>
        <DataTable
          headers={["Project Title", "Student", "Status", "Created"]}
          isLoading={isLoading}
          isEmpty={!data?.length}
          emptyIcon="📁"
          emptyTitle="No projects found"
          emptyDescription="Create the first student project above."
          colCount={4}
        >
          {data?.map((proj) => (
            <TR
              key={proj.id}
              onClick={() => navigate(`/student-projects/${proj.id}`)}
              style={{ cursor: "pointer" }}
            >
              <TD>
                <span style={{ fontWeight: 500 }}>{proj.project_title}</span>
              </TD>
              <TD>
                <span style={{ fontSize: 13 }}>
                  {proj.student_name ?? proj.student_id.slice(0, 8) + "…"}
                </span>
              </TD>
              <TD>
                <Badge label={proj.status} color={STATUS_BADGE[proj.status]} />
              </TD>
              <TD muted>{new Date(proj.created_at).toLocaleDateString()}</TD>
            </TR>
          ))}
        </DataTable>
      </Card>
    </div>
  );
}
