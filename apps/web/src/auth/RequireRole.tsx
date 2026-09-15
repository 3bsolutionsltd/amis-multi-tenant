import { type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

interface RequireRoleProps {
  children: ReactNode;
  /** At least one of these roles must match the current user's role. */
  roles: string[];
}

/**
 * Renders children only if the current user has one of the allowed roles.
 * Must be used inside an already-authenticated route (i.e., inside ProtectedRoute).
 * Redirects to /dashboard (index) on mismatch so the user lands somewhere valid.
 */
export function RequireRole({ children, roles }: RequireRoleProps) {
  const { user } = useAuth();

  const assignedRoles = user?.roles?.length ? user.roles : user ? [user.role] : [];
  if (!user || !roles.some((role) => assignedRoles.includes(role))) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
