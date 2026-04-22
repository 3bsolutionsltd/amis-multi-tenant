import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listStudentDocuments,
  uploadStudentDocument,
  downloadStudentDocument,
  deleteStudentDocument,
  fileToBase64,
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  type DocumentType,
} from "./student-documents.api";
import {
  Card,
  SectionLabel,
  SecondaryBtn,
  PrimaryBtn,
  ErrorBanner,
  Modal,
  Field,
  inputCss,
  selectCss,
  C,
} from "../../lib/ui";

const DOC_ICONS: Record<DocumentType, string> = {
  photo: "🖼️",
  id_card: "🪪",
  birth_certificate: "📜",
  academic_certificate: "🎓",
  medical: "🏥",
  recommendation: "📩",
  other: "📎",
};

const MAX_FILE_MB = 5;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

interface Props {
  studentId: string;
}

export function StudentDocumentsSection({ studentId }: Props) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showUpload, setShowUpload] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [form, setForm] = useState<{
    document_type: DocumentType;
    notes: string;
    file: File | null;
  }>({ document_type: "other", notes: "", file: null });

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["student-documents", studentId],
    queryFn: () => listStudentDocuments(studentId),
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!form.file) throw new Error("No file selected");
      if (form.file.size > MAX_FILE_BYTES)
        throw new Error(`File exceeds ${MAX_FILE_MB} MB limit`);
      const file_data = await fileToBase64(form.file);
      return uploadStudentDocument(studentId, {
        document_type: form.document_type,
        file_name: form.file.name,
        mime_type: form.file.type || "application/octet-stream",
        file_data,
        notes: form.notes || undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student-documents", studentId] });
      setShowUpload(false);
      setForm({ document_type: "other", notes: "", file: null });
      setUploadError("");
    },
    onError: (err: Error) => {
      setUploadError(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (docId: string) =>
      deleteStudentDocument(studentId, docId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student-documents", studentId] });
    },
  });

  async function handleView(docId: string, fileName: string, mimeType: string) {
    const doc = await downloadStudentDocument(studentId, docId);
    const byteChars = atob(doc.file_data);
    const byteArr = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteArr[i] = byteChars.charCodeAt(i);
    }
    const blob = new Blob([byteArr], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <SectionLabel>Documents &amp; Photos</SectionLabel>
        <SecondaryBtn onClick={() => setShowUpload(true)}>
          + Upload
        </SecondaryBtn>
      </div>

      {isLoading ? (
        <Card padding="16px 20px">
          <div
            style={{
              height: 40,
              borderRadius: 6,
              background: C.gray100,
              animation: "amis-pulse 1.5s ease-in-out infinite",
            }}
          />
        </Card>
      ) : docs.length === 0 ? (
        <Card padding="16px 20px">
          <span style={{ fontSize: 13, color: C.gray400 }}>
            No documents uploaded yet.
          </span>
        </Card>
      ) : (
        <Card>
          {docs.map((doc, i) => (
            <div
              key={doc.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 20px",
                borderBottom:
                  i < docs.length - 1 ? `1px solid ${C.gray100}` : "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 22 }}>
                  {DOC_ICONS[doc.document_type]}
                </span>
                <div>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 14,
                      color: C.gray900,
                    }}
                  >
                    {doc.file_name}
                  </div>
                  <div style={{ fontSize: 12, color: C.gray500 }}>
                    {DOCUMENT_TYPE_LABELS[doc.document_type]} &middot;{" "}
                    {doc.file_size_kb} KB &middot;{" "}
                    {new Date(doc.created_at).toLocaleDateString()}
                    {doc.notes && (
                      <span style={{ fontStyle: "italic" }}>
                        {" "}
                        — {doc.notes}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() =>
                    handleView(doc.id, doc.file_name, doc.mime_type)
                  }
                  style={{
                    fontSize: 12,
                    color: C.primary,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 600,
                    padding: "4px 8px",
                  }}
                >
                  ⬇ Download
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(`Delete "${doc.file_name}"?`)) {
                      deleteMutation.mutate(doc.id);
                    }
                  }}
                  disabled={deleteMutation.isPending}
                  style={{
                    fontSize: 12,
                    color: C.red,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "4px 8px",
                  }}
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <Modal
          title="Upload Document"
          onClose={() => {
            setShowUpload(false);
            setUploadError("");
            setForm({ document_type: "other", notes: "", file: null });
          }}
          footer={
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <SecondaryBtn
                onClick={() => {
                  setShowUpload(false);
                  setUploadError("");
                  setForm({ document_type: "other", notes: "", file: null });
                }}
              >
                Cancel
              </SecondaryBtn>
              <PrimaryBtn
                onClick={() => uploadMutation.mutate()}
                disabled={!form.file || uploadMutation.isPending}
              >
                {uploadMutation.isPending ? "Uploading…" : "Upload"}
              </PrimaryBtn>
            </div>
          }
        >
          <div
            style={{ display: "flex", flexDirection: "column", gap: 14 }}
          >
            {uploadError && <ErrorBanner message={uploadError} />}

            <Field label="Document Type">
              <select
                style={selectCss}
                value={form.document_type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    document_type: e.target.value as DocumentType,
                  })
                }
              >
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {DOCUMENT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={`File (max ${MAX_FILE_MB} MB)`}>
              <input
                ref={fileInputRef}
                type="file"
                style={{ ...inputCss, padding: "6px 10px" }}
                accept="image/*,.pdf,.doc,.docx"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  if (f && f.size > MAX_FILE_BYTES) {
                    setUploadError(`File exceeds ${MAX_FILE_MB} MB limit`);
                    e.target.value = "";
                    setForm({ ...form, file: null });
                  } else {
                    setUploadError("");
                    setForm({ ...form, file: f });
                  }
                }}
              />
            </Field>

            <Field label="Notes (optional)">
              <input
                style={inputCss}
                value={form.notes}
                onChange={(e) =>
                  setForm({ ...form, notes: e.target.value })
                }
                placeholder="e.g. Original verified"
                maxLength={500}
              />
            </Field>
          </div>
        </Modal>
      )}
    </div>
  );
}
