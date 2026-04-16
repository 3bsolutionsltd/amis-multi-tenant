import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "./app/AppShell";
import { StudentsListPage } from "./modules/students/StudentsListPage";
import { StudentCreatePage } from "./modules/students/StudentCreatePage";
import { StudentDetailPage } from "./modules/students/StudentDetailPage";
import { AdmissionsListPage } from "./modules/admissions/AdmissionsListPage";
import { ApplicationCreatePage } from "./modules/admissions/ApplicationCreatePage";
import { ApplicationDetailPage } from "./modules/admissions/ApplicationDetailPage";
import { AdmissionsImportPage } from "./modules/admissions/AdmissionsImportPage";
import { UsersListPage } from "./modules/users/UsersListPage";
import { UserCreatePage } from "./modules/users/UserCreatePage";
import { FeesPage } from "./modules/fees/FeesPage";
import { FeeEntryPage } from "./modules/fees/FeeEntryPage";
import { FeesImportPage } from "./modules/fees/FeesImportPage";
import { MarksListPage } from "./modules/marks/MarksListPage";
import { MarkCreatePage } from "./modules/marks/MarkCreatePage";
import { MarkDetailPage } from "./modules/marks/MarkDetailPage";
import { TermRegistrationsListPage } from "./modules/term-registrations/TermRegistrationsListPage";
import { TermRegistrationCreatePage } from "./modules/term-registrations/TermRegistrationCreatePage";
import { TermRegistrationDetailPage } from "./modules/term-registrations/TermRegistrationDetailPage";
import { AdminStudioLayout } from "./admin-studio/AdminStudioLayout";
import { ConfigDashboard } from "./admin-studio/ConfigDashboard";
import { ConfigEditor } from "./admin-studio/ConfigEditor";
import { WorkflowViewer } from "./admin-studio/WorkflowViewer";
import { NavigationEditor } from "./admin-studio/NavigationEditor";
import { DashboardPage } from "./modules/dashboard/DashboardPage";
import { LoginPage } from "./auth/LoginPage";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { ProgrammesListPage } from "./modules/programmes/ProgrammesListPage";
import { ProgrammeDetailPage } from "./modules/programmes/ProgrammeDetailPage";
import { IndustrialTrainingListPage } from "./modules/industrial-training/IndustrialTrainingListPage";
import { IndustrialTrainingCreatePage } from "./modules/industrial-training/IndustrialTrainingCreatePage";
import { IndustrialTrainingDetailPage } from "./modules/industrial-training/IndustrialTrainingDetailPage";
import { FieldPlacementsListPage } from "./modules/field-placements/FieldPlacementsListPage";
import { FieldPlacementCreatePage } from "./modules/field-placements/FieldPlacementCreatePage";
import { FieldPlacementDetailPage } from "./modules/field-placements/FieldPlacementDetailPage";
import { AnalyticsPage } from "./modules/analytics/AnalyticsPage";
import { StaffListPage } from "./modules/staff/StaffListPage";
import { StaffDetailPage } from "./modules/staff/StaffDetailPage";

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
        element: <DashboardPage />,
      },
      { path: "students", element: <StudentsListPage /> },
      { path: "students/new", element: <StudentCreatePage /> },
      { path: "students/:id", element: <StudentDetailPage /> },
      { path: "admissions", element: <AdmissionsListPage /> },
      { path: "admissions/new", element: <ApplicationCreatePage /> },
      { path: "admissions/import", element: <AdmissionsImportPage /> },
      { path: "admissions/:id", element: <ApplicationDetailPage /> },
      { path: "users", element: <UsersListPage /> },
      { path: "users/new", element: <UserCreatePage /> },
      { path: "finance", element: <FeesPage /> },
      { path: "finance/entry", element: <FeeEntryPage /> },
      { path: "finance/import", element: <FeesImportPage /> },
      { path: "marks", element: <MarksListPage /> },
      { path: "marks/new", element: <MarkCreatePage /> },
      { path: "marks/:id", element: <MarkDetailPage /> },
      { path: "term-registrations", element: <TermRegistrationsListPage /> },
      { path: "term-registrations/new", element: <TermRegistrationCreatePage /> },
      { path: "term-registrations/:id", element: <TermRegistrationDetailPage /> },
      { path: "programmes", element: <ProgrammesListPage /> },
      { path: "programmes/:id", element: <ProgrammeDetailPage /> },
      { path: "industrial-training", element: <IndustrialTrainingListPage /> },
      { path: "industrial-training/new", element: <IndustrialTrainingCreatePage /> },
      { path: "industrial-training/:id", element: <IndustrialTrainingDetailPage /> },
      { path: "field-placements", element: <FieldPlacementsListPage /> },
      { path: "field-placements/new", element: <FieldPlacementCreatePage /> },
      { path: "field-placements/:id", element: <FieldPlacementDetailPage /> },
      { path: "analytics", element: <AnalyticsPage /> },
      { path: "staff", element: <StaffListPage /> },
      { path: "staff/:id", element: <StaffDetailPage /> },
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
