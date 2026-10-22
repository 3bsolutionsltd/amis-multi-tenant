export function resolveApiBaseUrl(
  configuredUrl: string | undefined,
  isDevelopment: boolean,
  hostname: string,
): string {
  const configured = configuredUrl?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  if (isDevelopment) return "http://localhost:3000";
  return `http://${hostname || "localhost"}:3001`;
}

export const API_BASE_URL = resolveApiBaseUrl(
  import.meta.env.VITE_API_URL,
  import.meta.env.DEV,
  typeof window === "undefined" ? "localhost" : window.location.hostname,
);
