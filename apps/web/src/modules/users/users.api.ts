import { apiFetch } from "../../lib/apiFetch";

export const VALID_ROLES = [
  "admin",
  "registrar",
  "hod",
  "instructor",
  "finance",
  "principal",
  "dean",
] as const;

export type UserRole = (typeof VALID_ROLES)[number];

export interface User {
  id: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface CreateUserBody {
  email: string;
  password: string;
  role: UserRole;
}

export interface UpdateUserBody {
  role?: UserRole;
  isActive?: boolean;
}

export interface ListUsersParams {
  role?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export function listUsers(params?: ListUsersParams): Promise<User[]> {
  const q = new URLSearchParams();
  if (params?.role) q.set("role", params.role);
  if (params?.isActive != null) q.set("isActive", String(params.isActive));
  if (params?.page != null) q.set("page", String(params.page));
  if (params?.limit != null) q.set("limit", String(params.limit));
  const qs = q.toString();
  return apiFetch<User[]>(`/users${qs ? `?${qs}` : ""}`);
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
