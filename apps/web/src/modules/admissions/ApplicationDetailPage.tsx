import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getApplication,
  getWorkflowDef,
  fireTransition,
  enrollApplication,
  getWorkflowHistory,
} from "./admissions.api";
import type { Application, EnrollBody, WorkflowEvent } from "./admissions.api";
import { useAuth } from "../../auth/AuthContext";
import {
  ensureGlobalCss,
  Spinner,
  PageHeader,
  Card,
  DetailRow,
  Badge,
  Field,
  PrimaryBtn,
  SecondaryBtn,
  ErrorBanner,
  SectionLabel,
  Modal,
  inputCss,
  selectCss,
} from "../../lib/ui";

const STATE_BADGE_COLOR: Record<
  string,
  "gray" | "blue" | "yellow" | "purple" | "green" | "red" | "cyan"
> = {
  ADMITTED: "blue",
  REPORTED: "yellow",
  FEE_CLEARED: "green",
  REGISTERED: "purple",
  DRAFT: "gray",
  SUBMITTED: "blue",
  UNDER_REVIEW: "yellow",
  COMMITTEE_REVIEW: "purple",
  APPROVED_GOVT: "green",
  APPROVED_PRIVATE: "green",
  REJECTED: "red",
  ENROLLED: "cyan",
  WITHDRAWN: "red",
};

const ENROLLABLE_STATES = new Set(["REGISTERED"]);

function formatExtKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function ExtensionFields({ ext }: { ext: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  const entries = Object.entries(ext).filter(
    ([, v]) => v !== null && v !== undefined && v !== "",
  );
  if (entries.length === 0) return null;
  return (
    <Card padding="0 24px" style={{ marginBottom: 20 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 0",
          cursor: "pointer",
          userSelect: "none",
        }}
        onClick={() => setOpen((o) => !o)}
      >
        <SectionLabel>
          Additional Details ({entries.length} fields)
        </SectionLabel>
        <span style={{ fontSize: 18, color: "#6b7280" }}>
          {open ? "▲" : "▼"}
        </span>
      </div>
      {open &&
        entries.map(([k, v]) => (
          <DetailRow key={k} label={formatExtKey(k)}>
            {typeof v === "object" ? JSON.stringify(v) : String(v)}
          </DetailRow>
        ))}
    </Card>
  );
}

// ─── Enrol Modal ────────────────────────────────────────────────────────────
const GUARDIAN_RELS = [
  "Mother","Father","Brother","Sister","Uncle","Aunt",
  "Grandparent","Guardian","Other",
];

const UGANDA_DISTRICTS = [
  "Abim","Adjumani","Agago","Alebtong","Amolatar","Amudat","Amuria",
  "Amuru","Apac","Arua","Budaka","Bududa","Bugiri","Bugweri","Buhweju",
  "Buikwe","Bukedea","Bukomansimbi","Bukwo","Bulambuli","Buliisa",
  "Bundibugyo","Bunyangabu","Bushenyi","Busia","Butaleja","Butebo",
  "Buvuma","Buyende","Dokolo","Gomba","Gulu","Hoima","Ibanda","Iganga",
  "Isingiro","Jinja","Kaabong","Kabale","Kabarole","Kaberamaido",
  "Kagadi","Kakumiro","Kalangala","Kaliro","Kalungu","Kampala",
  "Kamuli","Kamwenge","Kanungu","Kapchorwa","Kapelebyong","Karenga",
  "Kasanda","Kasese","Katakwi","Kayunga","Kazo","Kibaale","Kiboga",
  "Kibuku","Kikuube","Kiruhura","Kiryandongo","Kisoro","Kitgum",
  "Koboko","Kole","Kotido","Kumi","Kwania","Kween","Kyankwanzi",
  "Kyegegwa","Kyenjojo","Kyotera","Lamwo","Lira","Luuka","Luwero",
  "Lwengo","Lyantonde","Madi-Okollo","Manafwa","Maracha","Masaka",
  "Masindi","Mayuge","Mbale","Mbarara","Mitooma","Mityana","Moroto",
  "Moyo","Mpigi","Mubende","Mukono","Nabilatuk","Nakapiripirit",
  "Nakaseke","Nakasongola","Namayingo","Namisindwa","Namutumba",
  "Napak","Nebbi","Ngora","Ntoroko","Ntungamo","Nwoya","Obongi",
  "Omoro","Otuke","Oyam","Pader","Pakwach","Pallisa","Rakai",
  "Rubanda","Rubirizi","Rukiga","Rukungiri","Rwampara","Sembabule",
  "Serere","Sheema","Sironko","Soroti","Tororo","Wakiso","Yumbe",
  "Zombo",
].sort();

function EnrolModal({
  app,
  onClose,
  onSuccess,
}: {
  app: Application;
  onClose: () => void;
  onSuccess: (studentId: string) => void;
}) {
  const [form, setForm] = useState({
    admission_number: "",
    nin: "",
    other_names: "",
    year_of_study: "",
    class_section: "",
    district_of_origin: "",
    guardian_name: "",
    guardian_relationship: "",
    guardian_phone: "",
    guardian_email: "",
    programme_code: "",
    assessment_level: "",
    previous_index: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const extras: EnrollBody = {
        admission_number: form.admission_number.trim() || undefined,
        nin: form.nin.trim() || undefined,
        other_names: form.other_names.trim() || undefined,
        year_of_study: form.year_of_study ? Number(form.year_of_study) : undefined,
        class_section: form.class_section.trim() || undefined,
        district_of_origin: form.district_of_origin.trim() || undefined,
        guardian_name: form.guardian_name.trim() || undefined,
        guardian_relationship: form.guardian_relationship || undefined,
        guardian_phone: form.guardian_phone.trim() || undefined,
        guardian_email: form.guardian_email.trim() || undefined,
        programme_code: form.programme_code.trim() || undefined,
        assessment_level: form.assessment_level ? Number(form.assessment_level) : undefined,
        previous_index: form.previous_index.trim() || undefined,
      };
      const result = await enrollApplication(app.id, extras);
      onSuccess(result.student.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enrolment failed");
    } finally {
      setSaving(false);
    }
  }

  const twoCol: React.CSSProperties = {
    display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12,
  };
  const sectionDivider: React.CSSProperties = {
    borderTop: "1px solid #e5e7eb",
    paddingTop: 12,
    marginTop: 4,
    fontSize: 11,
    fontWeight: 700,
    color: "#9ca3af",
    letterSpacing: "0.07em",
    textTransform: "uppercase",
  };

  return (
    <Modal
      title="🎓 Enrol as Student"
      onClose={onClose}
    >
      <div style={{ maxHeight: "62vh", overflowY: "auto", paddingRight: 2 }}>
        <form
          id="enrol-form"
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >
          {/* Pre-fill summary */}
          <div
            style={{
              background: "#f0f9ff",
              border: "1px solid #bae6fd",
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 13,
              color: "#0369a1",
              lineHeight: 1.5,
            }}
          >
            <strong>{app.first_name} {app.last_name}</strong>
            {" — "}{app.programme} · {app.intake}
            {app.sponsorship_type && ` · ${app.sponsorship_type}`}
            {app.gender && ` · ${app.gender}`}
          </div>
          {/* Admission Details */}
          <div style={twoCol}>
            <Field label="Admission No.">
              <input
                style={inputCss}
                placeholder="Auto-generated if blank"
                value={form.admission_number}
                onChange={(e) => set("admission_number", e.target.value)}
              />
            </Field>
            <Field label="Year of Study">
              <select
                style={selectCss}
                value={form.year_of_study}
                onChange={(e) => set("year_of_study", e.target.value)}
              >
                <option value="">— Year —</option>
                {[1,2,3,4,5,6].map((y) => (
                  <option key={y} value={y}>Year {y}</option>
                ))}
              </select>
            </Field>
          </div>
          <div style={twoCol}>
            <Field label="NIN">
              <input
                style={inputCss}
                placeholder="CM900123456DER"
                value={form.nin}
                onChange={(e) => set("nin", e.target.value)}
              />
            </Field>
            <Field label="Other Names">
              <input
                style={inputCss}
                value={form.other_names}
                onChange={(e) => set("other_names", e.target.value)}
              />
            </Field>
          </div>
          <div style={twoCol}>
            <Field label="Class / Section">
              <input
                style={inputCss}
                placeholder="e.g. A, Morning"
                value={form.class_section}
                onChange={(e) => set("class_section", e.target.value)}
              />
            </Field>
            <Field label="District of Origin">
              <select
                style={selectCss}
                value={form.district_of_origin}
                onChange={(e) => set("district_of_origin", e.target.value)}
              >
                <option value="">— Select District —</option>
                {UGANDA_DISTRICTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </Field>
          </div>
          {/* Guardian */}
          <div style={sectionDivider}>Guardian / Next of Kin</div>
          <Field label="Guardian Name">
            <input
              style={inputCss}
              value={form.guardian_name}
              onChange={(e) => set("guardian_name", e.target.value)}
            />
          </Field>
          <div style={twoCol}>
            <Field label="Relationship">
              <select
                style={selectCss}
                value={form.guardian_relationship}
                onChange={(e) => set("guardian_relationship", e.target.value)}
              >
                <option value="">— Select —</option>
                {GUARDIAN_RELS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </Field>
            <Field label="Guardian Phone">
              <input
                type="tel"
                style={inputCss}
                value={form.guardian_phone}
                onChange={(e) => set("guardian_phone", e.target.value)}
              />
            </Field>
          </div>
          <Field label="Guardian Email">
            <input
              type="email"
              style={inputCss}
              value={form.guardian_email}
              onChange={(e) => set("guardian_email", e.target.value)}
            />
          </Field>
          {/* UVTAB */}
          <div style={sectionDivider}>UVTAB / Exams (optional)</div>
          <div style={twoCol}>
            <Field label="Programme Code">
              <input
                style={inputCss}
                placeholder="e.g. NCBC-01"
                value={form.programme_code}
                onChange={(e) => set("programme_code", e.target.value)}
              />
            </Field>
            <Field label="Assessment Level">
              <select
                style={selectCss}
                value={form.assessment_level}
                onChange={(e) => set("assessment_level", e.target.value)}
              >
                <option value="">— Level —</option>
                {[1,2,3,4].map((l) => (
                  <option key={l} value={l}>Level {l}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Previous Index No.">
            <input
              style={inputCss}
              placeholder="e.g. U1234/567"
              value={form.previous_index}
              onChange={(e) => set("previous_index", e.target.value)}
            />
          </Field>
          {error && <ErrorBanner message={error} />}

          {/* Action buttons inside the form so type="submit" works */}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 4 }}>
            <SecondaryBtn type="button" onClick={onClose} disabled={saving}>
              Cancel
            </SecondaryBtn>
            <PrimaryBtn type="submit" disabled={saving}>
              {saving ? "Creating student…" : "Confirm Enrolment"}
            </PrimaryBtn>
          </div>
        </form>
      </div>
    </Modal>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export function ApplicationDetailPage() {
  ensureGlobalCss();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [showEnrolModal, setShowEnrolModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const { data: app, isLoading: appLoading } = useQuery({
    queryKey: ["application", id],
    queryFn: () => getApplication(id!),
    enabled: !!id,
  });

  const { data: wfDef } = useQuery({
    queryKey: ["workflowDef", "admissions"],
    queryFn: () => getWorkflowDef("admissions"),
  });

  const { data: historyEvents } = useQuery({
    queryKey: ["applicationHistory", id],
    queryFn: () => getWorkflowHistory("admissions", id!),
    enabled: !!id && showHistory,
  });

  const transitionMut = useMutation({
    mutationFn: (action: string) =>
      fireTransition("admissions", id!, "admissions", action),
    onSuccess: () => {
      setTransitionError(null);
      qc.invalidateQueries({ queryKey: ["application", id] });
    },
    onError: (err) => {
      setTransitionError(
        err instanceof Error ? err.message : "Transition failed",
      );
    },
  });

  if (appLoading) return <Spinner />;
  if (!app)
    return (
      <div>
        <PageHeader
          title="Application"
          back={{ label: "Admissions", to: "/admissions" }}
        />
        <ErrorBanner message="Application not found." />
      </div>
    );

  const currentState = app.current_state;
  const canEnrol = currentState !== null && ENROLLABLE_STATES.has(currentState);
  const myRole = user?.role ?? null;
  const superRoles = ["admin", "platform_admin"];

  // Filter transitions by current state AND whether this user's role is allowed.
  const availableTransitions = wfDef
    ? wfDef.transitions.filter((t) => {
        if (t.from !== currentState) return false;
        if (t.action === "enroll") return false;
        // Roles array takes precedence; fall back to required_role string.
        const allowed: string[] | null =
          t.roles && t.roles.length > 0
            ? t.roles
            : t.required_role
              ? [t.required_role]
              : null;
        if (!allowed) return true; // no role restriction
        return (
          myRole !== null &&
          (superRoles.includes(myRole) || allowed.includes(myRole))
        );
      })
    : [];

  return (
    <div>
      <PageHeader
        title={`${app.first_name} ${app.last_name}`}
        back={{ label: "Admissions", to: "/admissions" }}
        action={
          currentState ? (
            <Badge
              label={currentState}
              color={STATE_BADGE_COLOR[currentState] ?? "gray"}
            />
          ) : undefined
        }
      />
      <Card padding="0 24px" style={{ marginBottom: 20 }}>
        <DetailRow label="First name">{app.first_name}</DetailRow>
        <DetailRow label="Last name">{app.last_name}</DetailRow>
        <DetailRow label="Email">{app.email ?? "—"}</DetailRow>
        <DetailRow label="Phone">{app.phone ?? "—"}</DetailRow>
        <DetailRow label="Date of birth">
          {app.dob ? new Date(app.dob).toLocaleDateString() : "—"}
        </DetailRow>
        <DetailRow label="Gender">{app.gender ?? "—"}</DetailRow>
        <DetailRow label="Programme">{app.programme ?? "—"}</DetailRow>
        <DetailRow label="Intake">{app.intake ?? "—"}</DetailRow>
        <DetailRow label="Sponsorship type">
          {app.sponsorship_type ?? "—"}
        </DetailRow>
        <DetailRow label="Applied">
          {new Date(app.created_at).toLocaleString()}
        </DetailRow>
      </Card>

      {app.extension && Object.keys(app.extension).length > 0 && (
        <ExtensionFields ext={app.extension} />
      )}

      {availableTransitions.length > 0 && (
        <Card padding="20px 24px" style={{ marginBottom: 16 }}>
          <SectionLabel>Workflow Actions</SectionLabel>
          {transitionError && <ErrorBanner message={transitionError} />}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {availableTransitions.map((t) => (
              <PrimaryBtn
                key={t.action}
                disabled={transitionMut.isPending}
                onClick={() => transitionMut.mutate(t.action)}
              >
                {t.label ?? t.action.replace(/_/g, " ")}
              </PrimaryBtn>
            ))}
          </div>
        </Card>
      )}

      {/* Student record: show link if enrolled, else show enrol button */}
      {app.student_id ? (
        <Card padding="20px 24px">
          <SectionLabel>Student Record</SectionLabel>
          <p
            style={{ fontSize: 14, color: "#6b7280", margin: "0 0 14px" }}
          >
            This applicant has been enrolled as a student.
          </p>
          <SecondaryBtn onClick={() => navigate(`/students/${app.student_id}`)}>
            View Student Record →
          </SecondaryBtn>
        </Card>
      ) : canEnrol ? (
        <Card
          padding="20px 24px"
          style={{
            border: "2px dashed #93c5fd",
            background: "#f8faff",
          }}
        >
          <SectionLabel>Enrol as Student</SectionLabel>
          <p
            style={{ fontSize: 14, color: "#6b7280", margin: "0 0 14px" }}
          >
            Convert this application into a full student record. You can add
            NIN, year of study, guardian info, and more before confirming.
          </p>
          <PrimaryBtn onClick={() => setShowEnrolModal(true)}>
            🎓 Enrol as Student
          </PrimaryBtn>
        </Card>
      ) : (
        <Card padding="20px 24px" style={{ marginBottom: 16 }}>
          <SectionLabel>Enrol as Student</SectionLabel>
          <p
            style={{ fontSize: 14, color: "#6b7280", margin: 0 }}
          >
            Complete the available workflow actions until this application reaches
            REGISTERED before creating the student record.
          </p>
        </Card>
      )}

      {/* Workflow History (#198) */}
      <Card padding="20px 24px" style={{ marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <SectionLabel>Workflow History</SectionLabel>
          <SecondaryBtn onClick={() => setShowHistory((v) => !v)} style={{ fontSize: 12, padding: "4px 12px" }}>
            {showHistory ? "Hide" : "Show history"}
          </SecondaryBtn>
        </div>
        {showHistory && (
          <div style={{ marginTop: 12 }}>
            {!historyEvents ? (
              <Spinner />
            ) : historyEvents.length === 0 ? (
              <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>No history yet.</p>
            ) : (
              <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {historyEvents.map((ev: WorkflowEvent) => (
                  <li
                    key={ev.id}
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "flex-start",
                      paddingBottom: 10,
                      borderBottom: "1px solid #f3f4f6",
                      marginBottom: 10,
                      fontSize: 13,
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "#6366f1",
                        marginTop: 4,
                        flexShrink: 0,
                      }}
                    />
                    <div>
                      <div style={{ fontWeight: 500 }}>
                        {ev.action_key === "__init__"
                          ? `Created → ${ev.to_state}`
                          : `${ev.action_key.replace(/_/g, " ")} → ${ev.to_state}`}
                      </div>
                      <div style={{ color: "#6b7280", fontSize: 12 }}>
                        {new Date(ev.created_at).toLocaleString()}
                        {ev.actor_user_id ? ` · actor: ${ev.actor_user_id.slice(0, 8)}…` : ""}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </Card>

      {showEnrolModal && (
        <EnrolModal
          app={app}
          onClose={() => setShowEnrolModal(false)}
          onSuccess={(studentId) => {
            qc.invalidateQueries({ queryKey: ["application", id] });
            navigate(`/students/${studentId}`);
          }}
        />
      )}
    </div>
  );
}
