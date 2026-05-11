import { apiFetch } from "../../lib/apiFetch";

export const VALID_ROLES = [
  "admin",
  "registrar",
  "hod",
  "instructor",
  "finance",
  "principal",
  "dean",
  "procurement_officer",
  "inventory_manager",
] as const;

export type UserRole = (typeof VALID_ROLES)[number];

export interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface CreateUserBody {
  email: string;
  role: UserRole;
  firstName?: string;
  lastName?: string;
}

export interface UpdateUserBody {
  role?: UserRole;
  isActive?: boolean;
  firstName?: string;
  lastName?: string;
}

export interface ListUsersParams {
  role?: string;
  search?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface ListUsersResult {
  data: User[];
  total: number;
  page: number;
  limit: number;
}

export function listUsers(params?: ListUsersParams): Promise<ListUsersResult> {
  const q = new URLSearchParams();
  if (params?.role) q.set("role", params.role);
  if (params?.search) q.set("search", params.search);
  if (params?.isActive != null) q.set("isActive", String(params.isActive));
  if (params?.page != null) q.set("page", String(params.page));
  if (params?.limit != null) q.set("limit", String(params.limit));
  const qs = q.toString();
  return apiFetch<ListUsersResult>(`/users${qs ? `?${qs}` : ""}`);
}

export function createUser(body: CreateUserBody): Promise<User> {
  return apiFetch<User>("/users", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateUser(id: string, body: UpdateUserBody): Promise<User> {
  return apiFetch<User>(`/users/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function resetUserPassword(
  id: string,
  newPassword: string,
): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/users/${id}/password`, {
    method: "PUT",
    body: JSON.stringify({ newPassword }),
  });
}

export function getUser(id: string): Promise<User> {
  return apiFetch<User>(`/users/${id}`);
}

export interface AuditLogEntry {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
}

export function getIamAuditLog(userId: string): Promise<{ data: AuditLogEntry[] }> {
  return apiFetch<{ data: AuditLogEntry[] }>(`/users/${userId}/audit-log`);
}

export interface MeProfile {
  id: string;
  email: string;
  role: string;
  tenantId: string;
  isActive: boolean;
  lastLoginAt: string | null;
}

export function getMe(): Promise<MeProfile> {
  return apiFetch<MeProfile>("/auth/me");
}

export function changeMyPassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>("/auth/change-password", {
    method: "PUT",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}
