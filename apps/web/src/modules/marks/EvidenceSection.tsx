import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  uploadFile,
  addEvidence,
  removeEvidence,
  type EvidenceFile,
} from "./marks.api";
import {
  Card,
  SectionLabel,
  PrimaryBtn,
  ErrorBanner,
  C,
} from "../../lib/ui";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

function fileIcon(type: string): string {
  if (type.startsWith("image/")) return "🖼️";
  if (type === "application/pdf") return "📄";
  return "📎";
}

function isImage(type: string): boolean {
  return type.startsWith("image/");
}

export function EvidenceSection({
  submissionId,
  entryId,
  studentName,
  files,
}: {
  submissionId: string;
  entryId: string;
  studentName: string;
  files: EvidenceFile[];
}) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);

  const deleteMut = useMutation({
    mutationFn: (url: string) => removeEvidence(entryId, url),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["submission", submissionId] });
    },
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadErr(null);
    try {
      const uploaded = await uploadFile(file);
      await addEvidence(entryId, [uploaded]);
      qc.invalidateQueries({ queryKey: ["submission", submissionId] });
    } catch (err) {
      setUploadErr(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <SectionLabel>
          Evidence — {studentName}{" "}
          {files.length > 0 && (
            <span
              style={{
                background: C.blueBg,
                color: C.blueText,
                borderRadius: 99,
                fontSize: 11,
                fontWeight: 700,
                padding: "1px 8px",
                marginLeft: 6,
              }}
            >
              {files.length}
            </span>
          )}
        </SectionLabel>
        <PrimaryBtn
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? "Uploading…" : "+ Attach File"}
        </PrimaryBtn>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf,.doc,.docx"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
      </div>

      {uploadErr && <ErrorBanner message={uploadErr} />}

      {files.length === 0 ? (
        <p style={{ fontSize: 13, color: C.gray400, margin: 0 }}>
          No evidence files attached.
        </p>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {files.map((f) => (
            <div
              key={f.url}
              style={{
                border: `1px solid ${C.gray200}`,
                borderRadius: 8,
                overflow: "hidden",
                width: 120,
                position: "relative",
                background: "#fff",
              }}
            >
              {isImage(f.type) ? (
                <img
                  src={`${BASE_URL}${f.url}`}
                  alt={f.name}
                  style={{
                    width: "100%",
                    height: 80,
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: 80,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 32,
                    background: C.gray50,
                  }}
                >
                  {fileIcon(f.type)}
                </div>
              )}
              <div style={{ padding: "4px 6px 6px" }}>
                <a
                  href={`${BASE_URL}${f.url}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: 11,
                    color: C.primary,
                    display: "block",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    textDecoration: "none",
                  }}
                  title={f.name}
                >
                  {f.name}
                </a>
                <button
                  onClick={() => deleteMut.mutate(f.url)}
                  style={{
                    fontSize: 11,
                    color: C.red,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    marginTop: 2,
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
