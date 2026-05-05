import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createStudent, type CreateStudentBody } from "./students.api";
import { listProgrammes } from "../programmes/programmes.api";
import { ApiError } from "../../lib/apiFetch";
import { useConfig, type StudentFormField } from "../../app/ConfigProvider";
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
  SectionLabel,
  C,
} from "../../lib/ui";

const KNOWN_SELECT_OPTIONS: Record<string, string[]> = {
  gender: ["Male", "Female", "Other", "Prefer not to say"],
  sponsorship_type: [
    "Government",
    "Private",
    "Self-Sponsored",
    "Scholarship",
    "Other",
  ],
  district_of_origin: [
    "Abim", "Adjumani", "Agago", "Alebtong", "Amolatar", "Amudat", "Amuria",
    "Amuru", "Apac", "Arua", "Budaka", "Bududa", "Bugiri", "Buhweju",
    "Buikwe", "Bukedea", "Bukomansimbi", "Bukwo", "Bulambuli", "Buliisa",
    "Bundibugyo", "Bunyangabu", "Bushenyi", "Busia", "Butaleja", "Butebo",
    "Buvuma", "Buyende", "Dokolo", "Gomba", "Gulu", "Hoima", "Ibanda",
    "Iganga", "Isingiro", "Jinja", "Kaabong", "Kabale", "Kabarole",
    "Kaberamaido", "Kagadi", "Kakumiro", "Kalangala", "Kaliro", "Kalungu",
    "Kampala", "Kamuli", "Kamwenge", "Kanungu", "Kapchorwa", "Kapelebyong",
    "Kasanda", "Kasese", "Katakwi", "Kayunga", "Kazo", "Kibale", "Kiboga",
    "Kibuku", "Kikuube", "Kiruhura", "Kiryandongo", "Kisoro", "Kitagwenda",
    "Kitgum", "Koboko", "Kole", "Kotido", "Kumi", "Kwania", "Kyankwanzi",
    "Kyegegwa", "Kyenjojo", "Kyotera", "Lamwo", "Lira", "Luuka", "Luwero",
    "Lwengo", "Lyantonde", "Madi-Okollo", "Manafwa", "Maracha", "Masaka",
    "Masindi", "Mayuge", "Mbale", "Mbarara", "Mitooma", "Mityana", "Moroto",
    "Moyo", "Mpigi", "Mubende", "Mukono", "Nabilatuk", "Nakapiripirit",
    "Nakaseke", "Nakasongola", "Namayingo", "Namisindwa", "Namutumba",
    "Napak", "Nebbi", "Ngora", "Ntoroko", "Ntungamo", "Nwoya", "Obongi",
    "Omoro", "Otuke", "Oyam", "Pader", "Pakwach", "Pallisa", "Rakai",
    "Rubanda", "Rubirizi", "Rukiga", "Rukungiri", "Rwampara", "Sembabule",
    "Serere", "Sheema", "Sironko", "Soroti", "Tororo", "Wakiso", "Yumbe",
    "Zombo",
  ],
};

const FALLBACK_FIELDS: StudentFormField[] = [
  {
    key: "first_name",
    label: "First Name",
    type: "text",
    visible: true,
    order: 1,
  },
  {
    key: "last_name",
    label: "Last Name",
    type: "text",
    visible: true,
    order: 2,
  },
  {
    key: "date_of_birth",
    label: "Date of Birth",
    type: "date",
    visible: true,
    order: 3,
  },
];

export function StudentCreatePage() {
  ensureGlobalCss();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { studentFormConfig } = useConfig();

  const { data: programmes } = useQuery({
    queryKey: ["programmes"],
    queryFn: () => listProgrammes(),
  });

  const coreFields =
    studentFormConfig?.fields
      ?.filter((f) => f.visible !== false)
      .sort((a, b) => (a.order ?? 99) - (b.order ?? 99)) ?? FALLBACK_FIELDS;

  const coreFieldKeys = new Set(coreFields.map((f) => f.key));

  const extFields =
    studentFormConfig?.extensionFields
      ?.filter((f) => f.visible !== false && !coreFieldKeys.has(f.key))
      .sort((a, b) => (a.order ?? 99) - (b.order ?? 99)) ?? [];

  const [form, setForm] = useState<Record<string, string>>(
    Object.fromEntries(coreFields.map((f) => [f.key, ""])),
  );
  const [extForm, setExtForm] = useState<Record<string, string>>(
    Object.fromEntries(extFields.map((f) => [f.key, ""])),
  );
  const [guardianForm, setGuardianForm] = useState({
    guardian_name: "",
    guardian_phone: "",
    guardian_email: "",
    guardian_relationship: "",
  });
  const [uvtabForm, setUvtabForm] = useState({
    nin: "",
    other_names: "",
    gender: "",
    programme_code: "",
    assessment_level: "",
    previous_index: "",
  });
  const [yearOfStudy, setYearOfStudy] = useState<string>("");
  const [classSection, setClassSection] = useState<string>("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const mutation = useMutation({
    mutationFn: (body: CreateStudentBody) => createStudent(body),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["students"] });
      navigate(`/students/${created.id}`);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 422) {
        const body = err.body as {
          error?: { fieldErrors?: Record<string, string[]> };
        };
        setFieldErrors(body?.error?.fieldErrors ?? {});
      }
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    const payload: CreateStudentBody = {
      first_name: form.first_name ?? "",
      last_name: form.last_name ?? "",
    };
    // Map all known top-level columns that come from coreFields
    const CORE_COLUMN_KEYS: Array<keyof CreateStudentBody> = [
      "date_of_birth", "admission_number", "programme", "sponsorship_type",
      "email", "phone", "other_names", "nin", "programme_code", "previous_index",
    ];
    for (const key of CORE_COLUMN_KEYS) {
      const val = form[key];
      if (val) (payload as Record<string, unknown>)[key] = val;
    }
    if (yearOfStudy) payload.year_of_study = Number(yearOfStudy);
    if (classSection) payload.class_section = classSection;
    // Extension fields — only keys NOT already mapped as top-level columns
    const MAPPED_KEYS = new Set<string>([
      "first_name", "last_name", ...CORE_COLUMN_KEYS,
      "year_of_study", "class_section",
    ]);
    if (extFields.length > 0) {
      const ext: Record<string, unknown> = {};
      for (const f of extFields) {
        if (extForm[f.key]) ext[f.key] = extForm[f.key];
      }
      if (Object.keys(ext).length > 0) payload.extension = ext;
    }
    // Also catch any coreField values not in MAPPED_KEYS → extension
    const extraExt: Record<string, unknown> = {};
    for (const f of coreFields) {
      if (!MAPPED_KEYS.has(f.key) && form[f.key]) {
        extraExt[f.key] = form[f.key];
      }
    }
    if (Object.keys(extraExt).length > 0) {
      payload.extension = { ...payload.extension, ...extraExt };
    }
    if (guardianForm.guardian_name) payload.guardian_name = guardianForm.guardian_name;
    if (guardianForm.guardian_phone) payload.guardian_phone = guardianForm.guardian_phone;
    if (guardianForm.guardian_email) payload.guardian_email = guardianForm.guardian_email;
    if (guardianForm.guardian_relationship) payload.guardian_relationship = guardianForm.guardian_relationship;
    if (uvtabForm.nin) payload.nin = uvtabForm.nin;
    if (uvtabForm.other_names) payload.other_names = uvtabForm.other_names;
    if (uvtabForm.gender) payload.gender = uvtabForm.gender as "male" | "female" | "other";
    if (uvtabForm.programme_code) payload.programme_code = uvtabForm.programme_code;
    if (uvtabForm.assessment_level) payload.assessment_level = Number(uvtabForm.assessment_level);
    if (uvtabForm.previous_index) payload.previous_index = uvtabForm.previous_index;
    mutation.mutate(payload);
  }

  const apiError =
    mutation.isError &&
    !(mutation.error instanceof ApiError && mutation.error.status === 422)
      ? "Something went wrong. Please try again."
      : null;

  return (
    <div>
      <PageHeader
        title="New Student"
        back={{ label: "Students", to: "/students" }}
      />
      <Card padding="24px" style={{ maxWidth: 520 }}>
        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
          {coreFields.map((f) => (
            <Field
              key={f.key}
              label={f.label}
              required={f.key === "first_name" || f.key === "last_name"}
              error={fieldErrors[f.key]?.[0]}
            >
              {f.type === "date" ? (
                <input
                  type="date"
                  style={inputCss}
                  value={form[f.key] ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, [f.key]: e.target.value }))
                  }
                />
              ) : f.type === "textarea" ? (
                <textarea
                  style={{ ...inputCss, minHeight: 80 }}
                  value={form[f.key] ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, [f.key]: e.target.value }))
                  }
                />
              ) : f.key === "programme" ? (
                <select
                  style={selectCss}
                  value={form[f.key] ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, [f.key]: e.target.value }))
                  }
                >
                  <option value="">— Select Programme —</option>
                  {(programmes ?? []).map((p) => (
                    <option key={p.id} value={p.code}>
                      {p.code} — {p.title}
                    </option>
                  ))}
                </select>
              ) : f.type === "select" || KNOWN_SELECT_OPTIONS[f.key] ? (
                <select
                  style={selectCss}
                  value={form[f.key] ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, [f.key]: e.target.value }))
                  }
                >
                  <option value="">— Select —</option>
                  {(f.options ?? KNOWN_SELECT_OPTIONS[f.key] ?? []).map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <input
                  style={inputCss}
                  value={form[f.key] ?? ""}
                  required={f.key === "first_name" || f.key === "last_name"}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, [f.key]: e.target.value }))
                  }
                />
              )}
            </Field>
          ))}

          {extFields.length > 0 && (
            <>
              <SectionLabel>Additional Information</SectionLabel>
              {extFields.map((f) => (
                <Field
                  key={f.key}
                  label={f.label}
                  error={fieldErrors[f.key]?.[0]}
                >
                  {f.type === "date" ? (
                    <input
                      type="date"
                      style={inputCss}
                      value={extForm[f.key] ?? ""}
                      onChange={(e) =>
                        setExtForm((p) => ({ ...p, [f.key]: e.target.value }))
                      }
                    />
                  ) : f.type === "textarea" ? (
                    <textarea
                      style={{ ...inputCss, minHeight: 80 }}
                      value={extForm[f.key] ?? ""}
                      onChange={(e) =>
                        setExtForm((p) => ({ ...p, [f.key]: e.target.value }))
                      }
                    />
                  ) : f.type === "select" || KNOWN_SELECT_OPTIONS[f.key] ? (
                    <select
                      style={selectCss}
                      value={extForm[f.key] ?? ""}
                      onChange={(e) =>
                        setExtForm((p) => ({ ...p, [f.key]: e.target.value }))
                      }
                    >
                      <option value="">— Select —</option>
                      {(f.options ?? KNOWN_SELECT_OPTIONS[f.key] ?? []).map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      style={inputCss}
                      value={extForm[f.key] ?? ""}
                      onChange={(e) =>
                        setExtForm((p) => ({ ...p, [f.key]: e.target.value }))
                      }
                    />
                  )}
                </Field>
              ))}
            </>
          )}

          {apiError && <ErrorBanner message={apiError} />}

          {/* Academic placement */}
          <div style={{ fontSize: 11, fontWeight: 700, color: C.gray500, textTransform: "uppercase", letterSpacing: "0.07em", marginTop: 8 }}>Academic Placement</div>
          <Field label="Year of Study">
            <select
              style={selectCss}
              value={yearOfStudy}
              onChange={(e) => setYearOfStudy(e.target.value)}
            >
              <option value="">— Select Year —</option>
              {[1, 2, 3, 4, 5, 6].map((y) => (
                <option key={y} value={y}>Year {y}</option>
              ))}
            </select>
          </Field>
          <Field label="Class Section">
            <input
              style={inputCss}
              placeholder="e.g. A, B"
              value={classSection}
              onChange={(e) => setClassSection(e.target.value)}
            />
          </Field>

          {/* Guardian / Next-of-Kin section (SR-F-002) */}
          <div style={{ fontSize: 11, fontWeight: 700, color: C.gray500, textTransform: "uppercase", letterSpacing: "0.07em", marginTop: 8 }}>Guardian / Next of Kin (optional)</div>
          <Field label="Guardian name">
            <input
              style={inputCss}
              value={guardianForm.guardian_name}
              onChange={(e) => setGuardianForm((p) => ({ ...p, guardian_name: e.target.value }))}
              placeholder="Full name"
            />
          </Field>
          <Field label="Relationship">
            <input
              style={inputCss}
              value={guardianForm.guardian_relationship}
              onChange={(e) => setGuardianForm((p) => ({ ...p, guardian_relationship: e.target.value }))}
              placeholder="e.g. Mother, Father, Sibling"
            />
          </Field>
          <Field label="Guardian phone">
            <input
              style={inputCss}
              value={guardianForm.guardian_phone}
              onChange={(e) => setGuardianForm((p) => ({ ...p, guardian_phone: e.target.value }))}
              placeholder="+256 …"
            />
          </Field>
          <Field label="Guardian email">
            <input
              type="email"
              style={inputCss}
              value={guardianForm.guardian_email}
              onChange={(e) => setGuardianForm((p) => ({ ...p, guardian_email: e.target.value }))}
              placeholder="guardian@example.com"
            />
          </Field>

          {/* UVTAB / Exam Registration section */}
          <div style={{ fontSize: 11, fontWeight: 700, color: C.gray500, textTransform: "uppercase", letterSpacing: "0.07em", marginTop: 8 }}>UVTAB / Exam Registration (optional)</div>
          <Field label="NIN (National Identity Number)">
            <input
              style={inputCss}
              value={uvtabForm.nin}
              onChange={(e) => setUvtabForm((p) => ({ ...p, nin: e.target.value }))}
              placeholder="e.g. CM12345678ABCDE"
              maxLength={14}
            />
          </Field>
          <Field label="Other Names">
            <input
              style={inputCss}
              value={uvtabForm.other_names}
              onChange={(e) => setUvtabForm((p) => ({ ...p, other_names: e.target.value }))}
              placeholder="Middle or other given names"
            />
          </Field>
          <Field label="Gender">
            <select
              style={selectCss}
              value={uvtabForm.gender}
              onChange={(e) => setUvtabForm((p) => ({ ...p, gender: e.target.value }))}
            >
              <option value="">— Select —</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="Programme Code">
            <input
              style={inputCss}
              value={uvtabForm.programme_code}
              onChange={(e) => setUvtabForm((p) => ({ ...p, programme_code: e.target.value }))}
              placeholder="e.g. NCES, NCBC"
            />
          </Field>
          <Field label="Assessment Level (1–4)">
            <select
              style={selectCss}
              value={uvtabForm.assessment_level}
              onChange={(e) => setUvtabForm((p) => ({ ...p, assessment_level: e.target.value }))}
            >
              <option value="">— Select Level —</option>
              {[1, 2, 3, 4].map((l) => (
                <option key={l} value={l}>Level {l}</option>
              ))}
            </select>
          </Field>
          <Field label="Previous Index (PLE/UCE)">
            <input
              style={inputCss}
              value={uvtabForm.previous_index}
              onChange={(e) => setUvtabForm((p) => ({ ...p, previous_index: e.target.value }))}
              placeholder="e.g. U1234/5678"
            />
          </Field>

          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <PrimaryBtn type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving..." : "Create Student"}
            </PrimaryBtn>
            <SecondaryBtn type="button" onClick={() => navigate("/students")}>
              Cancel
            </SecondaryBtn>
          </div>
        </form>
      </Card>
    </div>
  );
}
