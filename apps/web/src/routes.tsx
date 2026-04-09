import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "./app/AppShell";
import { StudentsListPage } from "./modules/students/StudentsListPage";
import { StudentCreatePage } from "./modules/students/StudentCreatePage";
import { StudentDetailPage } from "./modules/students/StudentDetailPage";
import { AdmissionsListPage } from "./modules/admissions/AdmissionsListPage";
import { ApplicationCreatePage } from "./modules/admissions/ApplicationCreatePage";
import { ApplicationDetailPage } from "./modules/admissions/ApplicationDetailPage";
import { UsersListPage } from "./modules/users/UsersListPage";
import { UserCreatePage } from "./modules/users/UserCreatePage";
import { FeesPage } from "./modules/fees/FeesPage";
import { FeeEntryPage } from "./modules/fees/FeeEntryPage";
import { MarksListPage } from "./modules/marks/MarksListPage";
import { MarkCreatePage } from "./modules/marks/MarkCreatePage";
import { MarkDetailPage } from "./modules/marks/MarkDetailPage";
import { AdminStudioLayout } from "./admin-studio/AdminStudioLayout";
import { ConfigDashboard } from "./admin-studio/ConfigDashboard";
import { ConfigEditor } from "./admin-studio/ConfigEditor";
import { WorkflowViewer } from "./admin-studio/WorkflowViewer";
import { NavigationEditor } from "./admin-studio/NavigationEditor";
import { LoginPage } from "./auth/LoginPage";
import { ProtectedRoute } from "./auth/ProtectedRoute";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: (
          <div>
            <h2 style={{ marginTop: 0 }}>Welcome to AMIS</h2>
            <p style={{ color: "#6b7280" }}>
              Select a module from the sidebar to get started.
            </p>
          </div>
        ),
      },
      { path: "students", element: <StudentsListPage /> },
      { path: "students/new", element: <StudentCreatePage /> },
      { path: "students/:id", element: <StudentDetailPage /> },
      { path: "admissions", element: <AdmissionsListPage /> },
      { path: "admissions/new", element: <ApplicationCreatePage /> },
      { path: "admissions/:id", element: <ApplicationDetailPage /> },
      { path: "users", element: <UsersListPage /> },
      { path: "users/new", element: <UserCreatePage /> },
      { path: "finance", element: <FeesPage /> },
      { path: "finance/entry", element: <FeeEntryPage /> },
      { path: "marks", element: <MarksListPage /> },
      { path: "marks/new", element: <MarkCreatePage /> },
      { path: "marks/:id", element: <MarkDetailPage /> },
    ],
  },
  {
    path: "/admin-studio",
    element: (
      <ProtectedRoute>
        <AdminStudioLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <ConfigDashboard /> },
      { path: "editor", element: <ConfigEditor /> },
      { path: "workflows", element: <WorkflowViewer /> },
      { path: "navigation", element: <NavigationEditor /> },
    ],
  },
]);
