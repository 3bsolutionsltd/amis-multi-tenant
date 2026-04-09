import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "./app/AppShell";
import { StudentsListPage } from "./modules/students/StudentsListPage";
import { StudentCreatePage } from "./modules/students/StudentCreatePage";
import { StudentDetailPage } from "./modules/students/StudentDetailPage";
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
      {
        path: "admissions",
        element: (
          <div>
            <h2 style={{ marginTop: 0 }}>Admissions</h2>
            <p style={{ color: "#6b7280" }}>Coming soon — Track C.</p>
          </div>
        ),
      },
      {
        path: "finance",
        element: (
          <div>
            <h2 style={{ marginTop: 0 }}>Finance</h2>
            <p style={{ color: "#6b7280" }}>Coming soon — Track C.</p>
          </div>
        ),
      },
      {
        path: "marks",
        element: (
          <div>
            <h2 style={{ marginTop: 0 }}>Marks</h2>
            <p style={{ color: "#6b7280" }}>Coming soon — Track C.</p>
          </div>
        ),
      },
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
