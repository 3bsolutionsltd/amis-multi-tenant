import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import App from "./App";

// Bootstrap: ensure a default tenant is set so apiFetch always sends x-tenant-id
if (!localStorage.getItem("amis_tenant_id")) {
  localStorage.setItem(
    "amis_tenant_id",
    "10e575a2-2e59-437b-b251-c5b906a482d8",
  );
}

// Bootstrap: ensure a default dev role is set so apiFetch always sends x-dev-role
if (!localStorage.getItem("amis_dev_role")) {
  localStorage.setItem("amis_dev_role", "admin");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
