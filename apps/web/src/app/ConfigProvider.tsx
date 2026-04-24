import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/apiFetch";
import { useAuth } from "../auth/AuthContext";

export interface NavItem {
  label: string;
  route: string;
}

export interface DashCard {
  type: "KPI" | "ACTION";
  label: string;
  metricKey?: string;
  route?: string;
}

export interface StudentFormField {
  key: string;
  label: string;
  type?: "text" | "date" | "select" | "textarea";
  visible?: boolean;
  order?: number;
  options?: string[];
}

export interface StudentFormConfig {
  fields?: StudentFormField[];
  extensionFields?: StudentFormField[];
}

interface ConfigPayload {
  branding?: { appName?: string; logoUrl?: string };
  theme?: { primaryColor?: string };
  navigation?: Record<string, NavItem[]>;
  dashboards?: Record<string, DashCard[]>;
  forms?: { students?: StudentFormConfig };
  institution?: {
    departments?: string[];
    designations?: string[];
  };
}

interface ConfigData {
  id: string;
  status: string;
  payload: ConfigPayload;
  published_at: string | null;
  created_at: string;
}

interface ConfigContextValue {
  config: ConfigData | null;
  isLoading: boolean;
  appName: string;
  role: string;
  navigation: NavItem[];
  dashboards: DashCard[];
  primaryColor: string;
  studentFormConfig: StudentFormConfig | null;
  departments: string[];
  designations: string[];
}

const ConfigContext = createContext<ConfigContextValue>({
  config: null,
  isLoading: false,
  appName: "AMIS",
  role: "admin",
  navigation: [],
  dashboards: [],
  primaryColor: "#2563EB",
  studentFormConfig: null,
  departments: [],
  designations: [],
});

export function useConfig() {
  return useContext(ConfigContext);
}

export function ConfigProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const role = user?.role ?? localStorage.getItem("amis_dev_role") ?? "admin";

  const { data: config, isLoading } = useQuery<ConfigData>({
    queryKey: ["config"],
    queryFn: () => apiFetch<ConfigData>("/config"),
    staleTime: 60_000,
    retry: false,
    enabled: !!user,
  });

  const primaryColor = config?.payload?.theme?.primaryColor ?? "#2563EB";
  const appName = config?.payload?.branding?.appName ?? "AMIS";
  const navigation = config?.payload?.navigation?.[role] ?? [];
  const dashboards = config?.payload?.dashboards?.[role] ?? [];
  const studentFormConfig = config?.payload?.forms?.students ?? null;
  const departments = config?.payload?.institution?.departments ?? [];
  const designations = config?.payload?.institution?.designations ?? [];

  useEffect(() => {
    document.documentElement.style.setProperty("--primary-color", primaryColor);
  }, [primaryColor]);

  return (
    <ConfigContext.Provider
      value={{
        config: config ?? null,
        isLoading,
        appName,
        role,
        navigation,
        dashboards,
        primaryColor,
        studentFormConfig,
        departments,
        designations,
      }}
    >
      {children}
    </ConfigContext.Provider>
  );
}
