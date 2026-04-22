import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "./app/AppShell";
import { StudentsListPage } from "./modules/students/StudentsListPage";
import { StudentCreatePage } from "./modules/students/StudentCreatePage";
import { StudentDetailPage } from "./modules/students/StudentDetailPage";
import { StudentPromotionPage } from "./modules/students/StudentPromotionPage";
import { StudentsImportPage } from "./modules/students/StudentsImportPage";
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
import { BulkMarkEntryPage } from "./modules/marks/BulkMarkEntryPage";
import { TermRegistrationsListPage } from "./modules/term-registrations/TermRegistrationsListPage";
import { TermRegistrationCreatePage } from "./modules/term-registrations/TermRegistrationCreatePage";
import { TermRegistrationDetailPage } from "./modules/term-registrations/TermRegistrationDetailPage";
import { AdminStudioLayout } from "./admin-studio/AdminStudioLayout";
import { ConfigDashboard } from "./admin-studio/ConfigDashboard";
import { ConfigEditor } from "./admin-studio/ConfigEditor";
import { WorkflowViewer } from "./admin-studio/WorkflowViewer";
import { NavigationEditor } from "./admin-studio/NavigationEditor";
import { BrandingEditor } from "./admin-studio/BrandingEditor";
import { ModuleToggles } from "./admin-studio/ModuleToggles";
import { InstituteProfilePage } from "./admin-studio/InstituteProfilePage";
import { StudioUsersPage } from "./admin-studio/StudioUsersPage";
import { VtiSetupPage } from "./setup/VtiSetupPage";
import { PlatformAdminLayout } from "./platform-admin/PlatformAdminLayout";
import { PlatformOverview } from "./platform-admin/PlatformOverview";
import { PlatformTenantManager } from "./platform-admin/PlatformTenantManager";
import { ProvisionVtiPage } from "./platform-admin/ProvisionVtiPage";
import { DashboardPage } from "./modules/dashboard/DashboardPage";
import { LoginPage } from "./auth/LoginPage";
import { ForgotPasswordPage } from "./auth/ForgotPasswordPage";
import { ResetPasswordPage } from "./auth/ResetPasswordPage";
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
import { StaffCreatePage } from "./modules/staff/StaffCreatePage";
import { StaffDetailPage } from "./modules/staff/StaffDetailPage";
import { ITReportsPage } from "./modules/reports/ITReportsPage";
import { TeacherEvaluationsPage } from "./modules/reports/TeacherEvaluationsPage";
import { InstructorReportsPage } from "./modules/reports/InstructorReportsPage";
import { ClassListPage } from "./modules/reports/ClassListPage";
import { FeeCollectionReportPage } from "./modules/reports/FeeCollectionReportPage";
import { NcheEnrollmentPage } from "./modules/reports/NcheEnrollmentPage";
import { MarksAnalysisPage } from "./modules/results/MarksAnalysisPage";
import { TimetablePage } from "./modules/timetable/TimetablePage";
import { AttendancePage } from "./modules/attendance/AttendancePage";
import { AlumniListPage } from "./modules/alumni/AlumniListPage";
import { AlumniDetailPage } from "./modules/alumni/AlumniDetailPage";
import { SchoolPayReconciliationPage } from "./modules/fees/SchoolPayReconciliationPage";
import { FeeOverviewPage } from "./modules/fees/FeeOverviewPage";
import { FeeReceiptPage } from "./modules/fees/FeeReceiptPage";
import { PublicApplicationPage } from "./modules/public/PublicApplicationPage";
import { ResultsPage } from "./modules/results/ResultsPage";
import { ResultsSlipPage } from "./modules/results/ResultsSlipPage";
import { TranscriptPage } from "./modules/results/TranscriptPage";
import { ClearancePage } from "./modules/clearance/ClearancePage";
import { BulkRegistrationPage } from "./modules/term-registrations/BulkRegistrationPage";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/forgot-password",
    element: <ForgotPasswordPage />,
  },
  {
    path: "/reset-password",
    element: <ResetPasswordPage />,
  },
  {
    path: "/apply/:tenantSlug",
    element: <PublicApplicationPage />,
  },
  {
    path: "/setup",
    element: <VtiSetupPage />,
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
      { path: "students/import", element: <StudentsImportPage /> },
      { path: "students/promotion", element: <StudentPromotionPage /> },
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
      { path: "marks/bulk-entry", element: <BulkMarkEntryPage /> },
      { path: "marks/:id", element: <MarkDetailPage /> },
      { path: "term-registrations", element: <TermRegistrationsListPage /> },
      { path: "term-registrations/new", element: <TermRegistrationCreatePage /> },
      { path: "term-registrations/bulk", element: <BulkRegistrationPage /> },
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
      { path: "staff/new", element: <StaffCreatePage /> },
      { path: "staff/:id", element: <StaffDetailPage /> },
      { path: "staffs", element: <Navigate to="/staff" replace /> },
      { path: "reports/it", element: <ITReportsPage /> },
      { path: "reports/evaluations", element: <TeacherEvaluationsPage /> },
      { path: "reports/instructor", element: <InstructorReportsPage /> },
      { path: "reports/class-list", element: <ClassListPage /> },
      { path: "reports/fee-collection", element: <FeeCollectionReportPage /> },
      { path: "reports/nche-enrollment", element: <NcheEnrollmentPage /> },
      { path: "reports/marks-analysis", element: <MarksAnalysisPage /> },
      { path: "timetable", element: <TimetablePage /> },
      { path: "attendance", element: <AttendancePage /> },
      { path: "alumni", element: <AlumniListPage /> },
      { path: "alumni/:id", element: <AlumniDetailPage /> },
      { path: "finance/reconciliation", element: <SchoolPayReconciliationPage /> },
      { path: "finance/overview", element: <FeeOverviewPage /> },
      { path: "finance/receipt", element: <FeeReceiptPage /> },
      { path: "results", element: <ResultsPage /> },
      { path: "results/slip", element: <ResultsSlipPage /> },
      { path: "results/transcript", element: <TranscriptPage /> },
      { path: "clearance", element: <ClearancePage /> },
    ],
  },
  {
    path: "/platform-admin",
    element: (
      <ProtectedRoute>
        <PlatformAdminLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <PlatformOverview /> },
      { path: "tenants", element: <PlatformTenantManager /> },
      { path: "provision", element: <ProvisionVtiPage /> },
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
      { path: "profile", element: <InstituteProfilePage /> },
      { path: "users", element: <StudioUsersPage /> },
      { path: "editor", element: <ConfigEditor /> },
      { path: "branding", element: <BrandingEditor /> },
      { path: "modules", element: <ModuleToggles /> },
      { path: "workflows", element: <WorkflowViewer /> },
      { path: "navigation", element: <NavigationEditor /> },
    ],
  },
]);
