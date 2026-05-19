import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { AuthProvider } from "./auth/AuthContext";
import App from "./App";
import { registerSW } from "./lib/registerSW";

// Bootstrap: ensure a default dev role is set for dev-mode fallback in apiFetch
if (!localStorage.getItem("amis_dev_role")) {
  localStorage.setItem("amis_dev_role", "admin");
}

registerSW();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
