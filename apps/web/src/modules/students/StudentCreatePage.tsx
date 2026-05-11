import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createStudent, type CreateStudentBody } from "./students.api";
import { listProgrammes } from "../programmes/programmes.api";
import { ApiError } from "../../lib/apiFetch";
import {
  ensureGlobalCss,
  PageHeader,
  Card,
  Field,
  inputCss,
  selectCss,
  PrimaryBtn,
  SecondaryBtn,
  ErrorBanner,
  C,
} from "../../lib/ui";

// ─────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────
const UGANDA_DISTRICTS = [
  "Abim","Adjumani","Agago","Alebtong","Amolatar","Amudat","Amuria",
  "Amuru","Apac","Arua","Budaka","Bududa","Bugiri","Buhweju","Buikwe",
  "Bukedea","Bukomansimbi","Bukwo","Bulambuli","Buliisa","Bundibugyo",
  "Bunyangabu","Bushenyi","Busia","Butaleja","Butebo","Buvuma","Buyende",
  "Dokolo","Gomba","Gulu","Hoima","Ibanda","Iganga","Isingiro","Jinja",
  "Kaabong","Kabale","Kabarole","Kaberamaido","Kagadi","Kakumiro",
  "Kalangala","Kaliro","Kalungu","Kampala","Kamuli","Kamwenge","Kanungu",
  "Kapchorwa","Kapelebyong","Kasanda","Kasese","Katakwi","Kayunga","Kazo",
  "Kibale","Kiboga","Kibuku","Kikuube","Kiruhura","Kiryandongo","Kisoro",
  "Kitagwenda","Kitgum","Koboko","Kole","Kotido","Kumi","Kwania",
  "Kyankwanzi","Kyegegwa","Kyenjojo","Kyotera","Lamwo","Lira","Luuka",
  "Luwero","Lwengo","Lyantonde","Madi-Okollo","Manafwa","Maracha","Masaka",
  "Masindi","Mayuge","Mbale","Mbarara","Mitooma","Mityana","Moroto","Moyo",
  "Mpigi","Mubende","Mukono","Nabilatuk","Nakapiripirit","Nakaseke",
  "Nakasongola","Namayingo","Namisindwa","Namutumba","Napak","Nebbi",
  "Ngora","Ntoroko","Ntungamo","Nwoya","Obongi","Omoro","Otuke","Oyam",
  "Pader","Pakwach","Pallisa","Rakai","Rubanda","Rubirizi","Rukiga",
  "Rukungiri","Rwampara","Sembabule","Serere","Sheema","Sironko","Soroti",
  "Tororo","Wakiso","Yumbe","Zombo",
];

const GUARDIAN_RELATIONSHIPS = [
  "Mother","Father","Brother","Sister","Uncle","Aunt",
  "Grandparent","Guardian","Other",
];

const SPONSORSHIP_TYPES = [
  "Government","Private","Self-Sponsored","Scholarship","Other",
];

type Tab = "bio" | "placement" | "guardian" | "uvtab";

interface TabDef {
  key: Tab;
  label: string;
  shortLabel: string;
  icon: string;
}

const TABS: TabDef[] = [
  { key: "bio",       label: "Bio Data",            shortLabel: "Bio Data",   icon: "👤" },
  { key: "placement", label: "Academic Placement",  shortLabel: "Placement",  icon: "🎓" },
  { key: "guardian",  label: "Guardian / NOK",       shortLabel: "Guardian",   icon: "👪" },
  { key: "uvtab",     label: "UVTAB & Exams",        shortLabel: "UVTAB",      icon: "📋" },
];

// ─────────────────────────────────────────────────────────
// Unified form state
// ─────────────────────────────────────────────────────────
const INITIAL_FORM = {
  // Bio Data
  first_name: "", last_name: "", other_names: "", date_of_birth: "",
  gender: "", nin: "", phone: "", email: "", district_of_origin: "",
  // Academic Placement
  admission_number: "", programme: "", year_of_study: "", class_section: "",
  sponsorship_type: "", intake_year: "", entry_qualification: "",
  // Guardian / NOK
  guardian_name: "", guardian_relationship: "", guardian_phone: "", guardian_email: "",
  // UVTAB / Exams
  programme_code: "", assessment_level: "", previous_index: "",
};

type FormState = typeof INITIAL_FORM;

const TAB_FIELDS: Record<Tab, (keyof FormState)[]> = {
  bio:       ["first_name","last_name","other_names","date_of_birth","gender","nin","phone","email","district_of_origin"],
  placement: ["admission_number","programme","year_of_study","class_section","sponsorship_type","intake_year","entry_qualification"],
  guardian:  ["guardian_name","guardian_relationship","guardian_phone","guardian_email"],
  uvtab:     ["programme_code","assessment_level","previous_index"],
};

function hasTabData(tab: Tab, form: FormState): boolean {
  return TAB_FIELDS[tab].some((k) => !!form[k]);
}

// ─────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────
export function StudentCreatePage() {
  ensureGlobalCss();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("bio");
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const { data: programmes } = useQuery({
    queryKey: ["programmes"],
    queryFn: () => listProgrammes(),
  });

  const mutation = useMutation({
    mutationFn: (body: CreateStudentBody) => createStudent(body),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["students"] });
      navigate(`/students/${created.id}`);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 422) {
        const body = err.body as { error?: { fieldErrors?: Record<string, string[]> } };
        const fe: Record<string, string> = {};
        for (const [k, v] of Object.entries(body?.error?.fieldErrors ?? {})) {
          fe[k] = Array.isArray(v) ? v[0] : String(v);
        }
        setFieldErrors(fe);
      }
    },
  });

  function setField(key: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setForm((p) => ({ ...p, [key]: e.target.value }));
      setFieldErrors((p) => { const n = { ...p }; delete n[key]; return n; });
    };
  }

  function validateBio(): boolean {
    const errs: Record<string, string> = {};
    if (!form.first_name.trim()) errs.first_name = "First name is required";
    if (!form.last_name.trim())  errs.last_name  = "Last name is required";
    setFieldErrors((p) => ({ ...p, ...errs }));
    return Object.keys(errs).length === 0;
  }

  function goNext() {
    if (activeTab === "bio" && !validateBio()) return;
    const idx = TABS.findIndex((t) => t.key === activeTab);
    if (idx < TABS.length - 1) setActiveTab(TABS[idx + 1].key);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    if (!validateBio()) { setActiveTab("bio"); return; }

    const payload: CreateStudentBody = {
      first_name: form.first_name.trim(),
      last_name:  form.last_name.trim(),
    };
    if (form.other_names)     payload.other_names      = form.other_names;
    if (form.date_of_birth)   payload.date_of_birth    = form.date_of_birth;
    if (form.gender)          payload.gender           = form.gender as "male" | "female" | "other";
    if (form.nin)             payload.nin              = form.nin;
    if (form.phone)           payload.phone            = form.phone;
    if (form.email)           payload.email            = form.email;
    if (form.admission_number) payload.admission_number = form.admission_number;
    if (form.programme)       payload.programme        = form.programme;
    if (form.programme_code)  payload.programme_code   = form.programme_code;
    if (form.year_of_study)   payload.year_of_study    = Number(form.year_of_study);
    if (form.class_section)   payload.class_section    = form.class_section;
    if (form.sponsorship_type) payload.sponsorship_type = form.sponsorship_type;
    if (form.assessment_level) payload.assessment_level = Number(form.assessment_level);
    if (form.previous_index)  payload.previous_index   = form.previous_index;
    if (form.guardian_name)   payload.guardian_name    = form.guardian_name;
    if (form.guardian_phone)  payload.guardian_phone   = form.guardian_phone;
    if (form.guardian_email)  payload.guardian_email   = form.guardian_email;
    if (form.guardian_relationship) payload.guardian_relationship = form.guardian_relationship;

    // Fields stored in extension (not top-level columns)
    const ext: Record<string, unknown> = {};
    if (form.district_of_origin)  ext.district_of_origin  = form.district_of_origin;
    if (form.intake_year)         ext.intake_year         = form.intake_year;
    if (form.entry_qualification) ext.entry_qualification = form.entry_qualification;
    if (Object.keys(ext).length > 0) payload.extension = ext;

    mutation.mutate(payload);
  }

  const tabIdx = TABS.findIndex((t) => t.key === activeTab);
  const isLast  = tabIdx === TABS.length - 1;
  const apiError =
    mutation.isError && !(mutation.error instanceof ApiError && mutation.error.status === 422)
      ? "Something went wrong. Please try again."
      : null;

  // Layout helpers
  const grid2: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 20px" };
  const full:  React.CSSProperties = { gridColumn: "1 / -1" };

  return (
    <div>
      <PageHeader title="New Student" back={{ label: "Students", to: "/students" }} />
      <Card padding="28px 32px" style={{ maxWidth: 700 }}>

        {/* ── Step progress bar ── */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: 28 }}>
          {TABS.map((t, i) => {
            const isActive  = t.key === activeTab;
            const isDone    = !isActive && hasTabData(t.key, form);
            const circleClr = isActive ? C.blue : isDone ? C.green : C.gray300;
            const textClr   = isActive ? C.blue : isDone ? C.green : C.gray500;
            return (
              <React.Fragment key={t.key}>
                <button
                  type="button"
                  onClick={() => setActiveTab(t.key)}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                    background: "none", border: "none", cursor: "pointer", padding: "0 6px", flex: "0 0 auto" }}
                >
                  <div style={{
                    width: 34, height: 34, borderRadius: "50%", display: "flex",
                    alignItems: "center", justifyContent: "center",
                    fontWeight: 700, fontSize: 14, transition: "all 0.2s",
                    background: circleClr,
                    color: isActive || isDone ? "#fff" : C.gray500,
                    boxShadow: isActive ? "0 0 0 4px rgba(37,99,235,0.15)" : "none",
                  }}>
                    {isDone ? "✓" : i + 1}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: isActive ? 600 : 400, color: textClr, whiteSpace: "nowrap" }}>
                    {t.shortLabel}
                  </span>
                </button>
                {i < TABS.length - 1 && (
                  <div style={{ flex: 1, height: 2, marginBottom: 20,
                    background: isDone ? C.green : C.gray200, minWidth: 12 }} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* ── Tab heading ── */}
        <div style={{ fontSize: 16, fontWeight: 700, color: C.gray900, marginBottom: 20,
          paddingBottom: 12, borderBottom: `1px solid ${C.gray200}`,
          display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20 }}>{TABS[tabIdx].icon}</span>
          {TABS[tabIdx].label}
          <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 400, color: C.gray500 }}>
            Step {tabIdx + 1} of {TABS.length}
          </span>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* ── Tab 1: Bio Data ── */}
          {activeTab === "bio" && (
            <div style={grid2}>
              <Field label="First Name" required error={fieldErrors.first_name}>
                <input style={inputCss} placeholder="Given name" value={form.first_name}
                  onChange={setField("first_name")} autoFocus />
              </Field>
              <Field label="Last Name" required error={fieldErrors.last_name}>
                <input style={inputCss} placeholder="Surname / family name" value={form.last_name}
                  onChange={setField("last_name")} />
              </Field>
              <Field label="Other Names">
                <input style={inputCss} placeholder="Middle name(s)" value={form.other_names}
                  onChange={setField("other_names")} />
              </Field>
              <Field label="Date of Birth">
                <input type="date" style={inputCss} value={form.date_of_birth}
                  onChange={setField("date_of_birth")} />
              </Field>
              <Field label="Gender">
                <select style={selectCss} value={form.gender} onChange={setField("gender")}>
                  <option value="">— Select —</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other / Prefer not to say</option>
                </select>
              </Field>
              <Field label="National ID (NIN)">
                <input style={inputCss} placeholder="e.g. CM12345678ABCDE" maxLength={14}
                  value={form.nin} onChange={setField("nin")} />
              </Field>
              <Field label="Phone Number">
                <input style={inputCss} placeholder="+256 700 000 000" value={form.phone}
                  onChange={setField("phone")} />
              </Field>
              <Field label="Email Address">
                <input type="email" style={inputCss} placeholder="student@example.com"
                  value={form.email} onChange={setField("email")} />
              </Field>
              <div style={full}>
                <Field label="District of Origin">
                  <select style={selectCss} value={form.district_of_origin}
                    onChange={setField("district_of_origin")}>
                    <option value="">— Select District —</option>
                    {UGANDA_DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </Field>
              </div>
            </div>
          )}

          {/* ── Tab 2: Academic Placement ── */}
          {activeTab === "placement" && (
            <div style={grid2}>
              <Field label="Admission Number">
                <input style={inputCss} placeholder="e.g. GV/2025/001" value={form.admission_number}
                  onChange={setField("admission_number")} />
              </Field>
              <Field label="Intake Year">
                <input style={inputCss} placeholder={String(new Date().getFullYear())} maxLength={4}
                  value={form.intake_year} onChange={setField("intake_year")} />
              </Field>
              <div style={full}>
                <Field label="Programme">
                  <select style={selectCss} value={form.programme} onChange={setField("programme")}>
                    <option value="">— Select Programme —</option>
                    {(programmes ?? []).map((p) => (
                      <option key={p.id} value={p.code}>{p.code} — {p.title}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Year of Study">
                <select style={selectCss} value={form.year_of_study} onChange={setField("year_of_study")}>
                  <option value="">— Select Year —</option>
                  {[1, 2, 3, 4, 5, 6].map((y) => <option key={y} value={y}>Year {y}</option>)}
                </select>
              </Field>
              <Field label="Class / Section">
                <input style={inputCss} placeholder="e.g. A, B, Morning" value={form.class_section}
                  onChange={setField("class_section")} />
              </Field>
              <Field label="Sponsorship Type">
                <select style={selectCss} value={form.sponsorship_type} onChange={setField("sponsorship_type")}>
                  <option value="">— Select —</option>
                  {SPONSORSHIP_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Entry Qualification">
                <input style={inputCss} placeholder="e.g. UCE, PLE, UACE" value={form.entry_qualification}
                  onChange={setField("entry_qualification")} />
              </Field>
            </div>
          )}

          {/* ── Tab 3: Guardian / Next of Kin ── */}
          {activeTab === "guardian" && (
            <>
              <p style={{ margin: "0 0 8px", fontSize: 13, color: C.gray500, lineHeight: 1.6 }}>
                Guardian / Next of Kin contact details (optional but recommended).
              </p>
              <div style={grid2}>
                <div style={full}>
                  <Field label="Guardian Full Name">
                    <input style={inputCss} placeholder="Full name of guardian or parent"
                      value={form.guardian_name} onChange={setField("guardian_name")} />
                  </Field>
                </div>
                <Field label="Relationship">
                  <select style={selectCss} value={form.guardian_relationship}
                    onChange={setField("guardian_relationship")}>
                    <option value="">— Select —</option>
                    {GUARDIAN_RELATIONSHIPS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </Field>
                <Field label="Phone Number">
                  <input style={inputCss} placeholder="+256 700 000 000" value={form.guardian_phone}
                    onChange={setField("guardian_phone")} />
                </Field>
                <div style={full}>
                  <Field label="Email Address">
                    <input type="email" style={inputCss} placeholder="guardian@example.com"
                      value={form.guardian_email} onChange={setField("guardian_email")} />
                  </Field>
                </div>
              </div>
            </>
          )}

          {/* ── Tab 4: UVTAB / Exam Registration ── */}
          {activeTab === "uvtab" && (
            <>
              <p style={{ margin: "0 0 8px", fontSize: 13, color: C.gray500, lineHeight: 1.6 }}>
                UVTAB / UBTEB exam registration details. Required only for students sitting national examinations.
              </p>
              <div style={grid2}>
                <div style={full}>
                  <Field label="Programme Code (Exam Registration)">
                    <select style={selectCss} value={form.programme_code} onChange={setField("programme_code")}>
                      <option value="">— Select Programme Code —</option>
                      {(programmes ?? []).map((p) => (
                        <option key={p.id} value={p.code}>{p.code} — {p.title}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Field label="Assessment Level">
                  <select style={selectCss} value={form.assessment_level} onChange={setField("assessment_level")}>
                    <option value="">— Select Level —</option>
                    {[1, 2, 3, 4].map((l) => <option key={l} value={l}>Level {l}</option>)}
                  </select>
                </Field>
                <Field label="Previous Index (PLE / UCE)">
                  <input style={inputCss} placeholder="e.g. U1234/5678" value={form.previous_index}
                    onChange={setField("previous_index")} />
                </Field>
              </div>
            </>
          )}

          {apiError && <ErrorBanner message={apiError} />}

          {/* ── Navigation buttons ── */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8,
            paddingTop: 16, borderTop: `1px solid ${C.gray200}` }}>
            {tabIdx > 0 ? (
              <SecondaryBtn type="button" onClick={() => setActiveTab(TABS[tabIdx - 1].key)}>
                ← Back
              </SecondaryBtn>
            ) : (
              <SecondaryBtn type="button" onClick={() => navigate("/students")}>
                Cancel
              </SecondaryBtn>
            )}
            <div style={{ flex: 1 }} />
            {isLast ? (
              <>
                <SecondaryBtn type="button" onClick={() => navigate("/students")}>
                  Cancel
                </SecondaryBtn>
                <PrimaryBtn type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? "Saving…" : "✓ Create Student"}
                </PrimaryBtn>
              </>
            ) : (
              <PrimaryBtn type="button" onClick={goNext}>
                Next: {TABS[tabIdx + 1].shortLabel} →
              </PrimaryBtn>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}
