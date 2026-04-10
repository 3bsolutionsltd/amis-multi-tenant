import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createUser, VALID_ROLES } from "./users.api";
import {
  ensureGlobalCss,
  PageHeader,
  Card,
  Field,
  inputCss,
  selectCss,
  PrimaryBtn,
  ErrorBanner,
} from "../../lib/ui";

export function UserCreatePage() {
  ensureGlobalCss();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    password: "",
    role: "registrar",
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
      await createUser(form);
      navigate("/users");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="New User" back={{ label: "Users", to: "/users" }} />
      <Card padding="24px" style={{ maxWidth: 480 }}>
        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
          <Field label="Email" required>
            <input
              required
              type="email"
              autoComplete="off"
              style={inputCss}
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </Field>

          <Field label="Password" required>
            <input
              required
              type="password"
              autoComplete="new-password"
              style={inputCss}
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
            />
          </Field>

          <Field label="Role" required>
            <select
              required
              style={selectCss}
              value={form.role}
              onChange={(e) => set("role", e.target.value)}
            >
              {VALID_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Field>

          {error && <ErrorBanner message={error} />}

          <div style={{ marginTop: 4 }}>
            <PrimaryBtn type="submit" disabled={saving}>
              {saving ? "Creating…" : "Create User"}
            </PrimaryBtn>
          </div>
        </form>
      </Card>
    </div>
  );
}
