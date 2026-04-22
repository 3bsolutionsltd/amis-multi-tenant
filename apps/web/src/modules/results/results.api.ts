import { apiFetch } from "../../lib/apiFetch";

export interface TermGpaRow {
  student_id: string;
  first_name: string;
  last_name: string;
  admission_number: string | null;
  gpa: number;
  total_credits: number;
  rank: number | null;
}

export interface StudentTermResult {
  studentId: string;
  termId: string;
  courses: {
    course_id: string;
    score: number;
    grade: string | null;
    grade_point: number | null;
  }[];
  summary: {
    gpa: number;
    total_credits: number;
    rank: number | null;
  } | null;
}

export interface ProcessResultsResponse {
  processed: number;
  students: number;
  termId: string;
}

export function processResults(termId: string): Promise<ProcessResultsResponse> {
  return apiFetch<ProcessResultsResponse>(
    `/results/terms/${termId}/process`,
    { method: "POST" },
  );
}

export function getTermResults(termId: string): Promise<TermGpaRow[]> {
  return apiFetch<TermGpaRow[]>(`/results/terms/${termId}`);
}

export function getStudentTermResults(
  studentId: string,
  termId: string,
): Promise<StudentTermResult> {
  return apiFetch<StudentTermResult>(
    `/results/students/${studentId}/terms/${termId}`,
  );
}

export interface TranscriptTerm {
  termId: string;
  termName: string;
  academicYear: string;
  termNumber: number | null;
  courses: {
    course_id: string;
    score: number;
    grade: string | null;
    grade_point: number | null;
  }[];
  summary: {
    gpa: number;
    total_credits: number;
    rank: number | null;
  } | null;
}

export interface Transcript {
  student: {
    id: string;
    first_name: string;
    last_name: string;
    admission_number: string | null;
    programme: string | null;
    year_of_study: number | null;
    class_section: string | null;
  };
  terms: TranscriptTerm[];
  cumulativeGpa: number | null;
}

export function getTranscript(studentId: string): Promise<Transcript> {
  return apiFetch<Transcript>(`/results/students/${studentId}/transcript`);
}

// ─── Marks Analysis ───────────────────────────────────────────────────────────

export interface CourseAnalysis {
  course_id: string;
  total_students: number;
  mean_score: number;
  min_score: number;
  max_score: number;
  passed: number;
  failed: number;
  pass_rate: number;
  grade_distribution: { A: number; B: number; C: number; D: number; F: number };
}

export interface ProgrammeAnalysis {
  programme: string | null;
  total_students: number;
  mean_score: number;
  passed: number;
  failed: number;
  pass_rate: number;
  mean_gpa: number | null;
}

export interface GpaClassification {
  classification: string;
  count: number;
  avg_gpa: number;
}

export interface MarksAnalysisResult {
  by_course: CourseAnalysis[];
  by_programme: ProgrammeAnalysis[];
  gpa_distribution: GpaClassification[];
  filters: { term_id: string | null; programme: string | null; course_id: string | null };
}

export interface MarksAnalysisParams {
  term_id?: string;
  programme?: string;
  course_id?: string;
}

export async function getMarksAnalysis(
  params?: MarksAnalysisParams,
): Promise<MarksAnalysisResult> {
  const qs = new URLSearchParams(
    Object.entries(params ?? {})
      .filter(([, v]) => v !== undefined && v !== "")
      .map(([k, v]) => [k, String(v)]),
  ).toString();
  return apiFetch(`/results/analysis${qs ? `?${qs}` : ""}`);
}
