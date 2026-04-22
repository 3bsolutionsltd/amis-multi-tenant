import { apiFetch } from "../../lib/apiFetch";

export const DOCUMENT_TYPES = [
  "photo",
  "id_card",
  "birth_certificate",
  "academic_certificate",
  "medical",
  "recommendation",
  "other",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  photo: "Photo",
  id_card: "ID Card",
  birth_certificate: "Birth Certificate",
  academic_certificate: "Academic Certificate",
  medical: "Medical",
  recommendation: "Recommendation Letter",
  other: "Other",
};

export interface StudentDocument {
  id: string;
  document_type: DocumentType;
  file_name: string;
  mime_type: string;
  file_size_kb: number;
  notes?: string | null;
  created_at: string;
}

export interface StudentDocumentWithData extends StudentDocument {
  file_data: string; // base64
}

export interface UploadDocumentBody {
  document_type: DocumentType;
  file_name: string;
  mime_type: string;
  file_data: string; // base64
  notes?: string;
}

export function listStudentDocuments(studentId: string): Promise<StudentDocument[]> {
  return apiFetch(`/students/${studentId}/documents`);
}

export function uploadStudentDocument(
  studentId: string,
  body: UploadDocumentBody
): Promise<StudentDocument> {
  return apiFetch(`/students/${studentId}/documents`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function downloadStudentDocument(
  studentId: string,
  docId: string
): Promise<StudentDocumentWithData> {
  return apiFetch(`/students/${studentId}/documents/${docId}/download`);
}

export function deleteStudentDocument(
  studentId: string,
  docId: string
): Promise<void> {
  return apiFetch(`/students/${studentId}/documents/${docId}`, {
    method: "DELETE",
  });
}

/** Read a File as base64 string (without the data:...;base64, prefix) */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the "data:...;base64," prefix
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
