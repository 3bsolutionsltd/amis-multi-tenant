import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../lib/apiFetch";
import {
  createDraft,
  getConfigStatus,
  publishConfig,
  rollbackConfig,
  validateDraft,
} from "./admin-studio.api";

const btnStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: 4,
  padding: "7px 16px",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 500,
  background: "#fff",
  color: "#374151",
};

const btnPrimary: React.CSSProperties = {
  ...btnStyle,
  background: "#2563eb",
  color: "#fff",
  border: "1px solid #2563eb",
};

const btnGreen: React.CSSProperties = {
  ...btnStyle,
  background: "#16a34a",
  color: "#fff",
  border: "1px solid #16a34a",
};

const btnRed: React.CSSProperties = {
  ...btnStyle,
  background: "#dc2626",
  color: "#fff",
  border: "1px solid #dc2626",
};

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: 24,
  marginBottom: 24,
};

interface ValidateResult {
  valid: boolean;
  errors?: unknown;
}

export function ConfigEditor() {
  const qc = useQueryClient();
  const role = localStorage.getItem("amis_dev_role") ?? "admin";

  const {
    data: status,
    isLoading,
    refetch: refetchStatus,
  } = useQuery({
    queryKey: ["config/status"],
    queryFn: getConfigStatus,
    staleTime: 30_000,
  });

  // Initialize textarea once when status first loads
  const [json, setJson] = useState("");
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current && status !== undefined) {
      const payload =
        status?.draft?.payload ?? status?.published?.payload ?? {};
      setJson(JSON.stringify(payload, null, 2));
      initialized.current = true;
    }
  }, [status]);

  const [jsonError, setJsonError] = useState<string | null>(null);
  const [validateResult, setValidateResult] = useState<ValidateResult | null>(
    null,
  );
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [confirmRollback, setConfirmRollback] = useState(false);

  const hasDraft = !!status?.draft;
  const hasPublished = !!status?.published;

  // Save as Draft
  const saveDraftMut = useMutation({
    mutationFn: async () => {
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(json) as Record<string, unknown>;
      } catch {
        throw new Error("Invalid JSON — fix syntax before saving");
      }
      return createDraft(parsed);
    },
    onSuccess: () => {
      setJsonError(null);
      setValidateResult(null);
      void refetchStatus();
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        const body = err.body as Record<string, unknown>;
        setJsonError(
          typeof body?.error === "string" ? body.error : "Failed to save draft",
        );
      } else if (err instanceof Error) {
        setJsonError(err.message);
      } else {
        setJsonError("Failed to save draft");
      }
    },
  });

  // Validate
  const validateMut = useMutation({
    mutationFn: async (): Promise<ValidateResult> => {
      try {
        await validateDraft();
        return { valid: true, errors: undefined };
      } catch (err) {
        if (err instanceof ApiError && err.status === 422) {
          return { valid: false, errors: err.body };
        }
        throw err;
      }
    },
    onSuccess: (data) => setValidateResult(data),
    onError: () => setValidateResult({ valid: false }),
  });

  // Publish
  const publishMut = useMutation({
    mutationFn: () => publishConfig(role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["config"] });
      qc.invalidateQueries({ queryKey: ["config/status"] });
      qc.invalidateQueries({ queryKey: ["config/audit"] });
      setConfirmPublish(false);
      void refetchStatus();
    },
    onError: () => {
      setConfirmPublish(false);
    },
  });

  // Rollback
  const rollbackMut = useMutation({
    mutationFn: () => rollbackConfig(role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["config"] });
      qc.invalidateQueries({ queryKey: ["config/status"] });
      qc.invalidateQueries({ queryKey: ["config/audit"] });
      setConfirmRollback(false);
      initialized.current = false; // allow re-init from rolled-back payload
      void refetchStatus();
    },
    onError: () => {
      setConfirmRollback(false);
    },
  });

  if (isLoading) return <p style={{ color: "#64748b" }}>Loading…</p>;

  return (
    <div style={{ maxWidth: 880 }}>
      <h2 style={{ marginTop: 0, marginBottom: 8, color: "#0f172a" }}>
        Config Editor
      </h2>

      {/* Status bar */}
      <div
        style={{
          display: "flex",
          gap: 16,
          marginBottom: 20,
          fontSize: 13,
          color: "#64748b",
        }}
      >
        <span>
          Draft:{" "}
          <strong style={{ color: hasDraft ? "#16a34a" : "#94a3b8" }}>
            {hasDraft ? "exists" : "none"}
          </strong>
        </span>
        <span>
          Published:{" "}
          <strong style={{ color: hasPublished ? "#2563eb" : "#94a3b8" }}>
            {hasPublished ? "exists" : "none"}
          </strong>
        </span>
      </div>

      <div style={cardStyle}>
        <label
          style={{
            display: "block",
            fontWeight: 600,
            marginBottom: 8,
            color: "#374151",
            fontSize: 14,
          }}
        >
          JSON Payload
        </label>
        <textarea
          value={json}
          onChange={(e) => {
            setJson(e.target.value);
            setJsonError(null);
            setValidateResult(null);
          }}
          spellCheck={false}
          style={{
            width: "100%",
            height: 440,
            fontFamily: "monospace",
            fontSize: 13,
            padding: 10,
            border: `1px solid ${jsonError ? "#dc2626" : "#d1d5db"}`,
            borderRadius: 4,
            resize: "vertical",
            boxSizing: "border-box",
            color: "#0f172a",
          }}
        />
        {jsonError && (
          <p style={{ color: "#dc2626", margin: "6px 0 0", fontSize: 13 }}>
            {jsonError}
          </p>
        )}

        {/* Action buttons */}
        <div
          style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}
        >
          <button
            style={btnPrimary}
            onClick={() => saveDraftMut.mutate()}
            disabled={saveDraftMut.isPending}
          >
            {saveDraftMut.isPending ? "Saving…" : "Save as Draft"}
          </button>

          <button
            style={btnStyle}
            onClick={() => validateMut.mutate()}
            disabled={!hasDraft || validateMut.isPending}
            title={!hasDraft ? "Save a draft first" : ""}
          >
            {validateMut.isPending ? "Validating…" : "Validate"}
          </button>

          <button
            style={
              !hasDraft
                ? { ...btnGreen, opacity: 0.5, cursor: "not-allowed" }
                : btnGreen
            }
            onClick={() => setConfirmPublish(true)}
            disabled={!hasDraft || publishMut.isPending}
            title={!hasDraft ? "No draft to publish" : ""}
          >
            Publish…
          </button>

          <button
            style={
              !hasPublished
                ? { ...btnRed, opacity: 0.5, cursor: "not-allowed" }
                : btnRed
            }
            onClick={() => setConfirmRollback(true)}
            disabled={!hasPublished || rollbackMut.isPending}
            title={!hasPublished ? "No published config to roll back" : ""}
          >
            Rollback…
          </button>
        </div>

        {/* Validation result */}
        {validateResult && (
          <div
            style={{
              marginTop: 14,
              padding: 12,
              background: validateResult.valid ? "#dcfce7" : "#fee2e2",
              borderRadius: 4,
              border: `1px solid ${validateResult.valid ? "#86efac" : "#fca5a5"}`,
            }}
          >
            {validateResult.valid ? (
              <span style={{ color: "#15803d", fontWeight: 600, fontSize: 13 }}>
                ✓ Payload is valid
              </span>
            ) : (
              <pre
                style={{
                  margin: 0,
                  fontSize: 12,
                  color: "#991b1b",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {JSON.stringify(validateResult.errors, null, 2)}
              </pre>
            )}
          </div>
        )}

        {/* Publish/rollback error feedback */}
        {publishMut.isError && (
          <p style={{ color: "#dc2626", fontSize: 13, marginTop: 8 }}>
            Publish failed —{" "}
            {publishMut.error instanceof ApiError
              ? JSON.stringify((publishMut.error as ApiError).body)
              : "unexpected error"}
          </p>
        )}
        {rollbackMut.isError && (
          <p style={{ color: "#dc2626", fontSize: 13, marginTop: 8 }}>
            Rollback failed — no previous published config found.
          </p>
        )}
      </div>

      {/* Publish confirm dialog */}
      {confirmPublish && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
        >
          <div
            style={{
              background: "#fff",
              padding: 28,
              borderRadius: 10,
              width: 380,
              boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
            }}
          >
            <h3 style={{ marginTop: 0, color: "#0f172a" }}>
              Publish Configuration?
            </h3>
            <p style={{ color: "#374151", fontSize: 14 }}>
              This will make the current draft the active configuration for all
              users immediately.
            </p>
            <div
              style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}
            >
              <button style={btnStyle} onClick={() => setConfirmPublish(false)}>
                Cancel
              </button>
              <button
                style={btnGreen}
                onClick={() => publishMut.mutate()}
                disabled={publishMut.isPending}
              >
                {publishMut.isPending ? "Publishing…" : "Confirm Publish"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rollback confirm dialog */}
      {confirmRollback && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
        >
          <div
            style={{
              background: "#fff",
              padding: 28,
              borderRadius: 10,
              width: 380,
              boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
            }}
          >
            <h3 style={{ marginTop: 0, color: "#0f172a" }}>
              Rollback Configuration?
            </h3>
            <p style={{ color: "#374151", fontSize: 14 }}>
              This will restore the previous published configuration. The
              current published config will be archived.
            </p>
            <div
              style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}
            >
              <button
                style={btnStyle}
                onClick={() => setConfirmRollback(false)}
              >
                Cancel
              </button>
              <button
                style={btnRed}
                onClick={() => rollbackMut.mutate()}
                disabled={rollbackMut.isPending}
              >
                {rollbackMut.isPending ? "Rolling back…" : "Confirm Rollback"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
