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
import { UserDetailPage } from "./modules/users/UserDetailPage";
import { ProfilePage } from "./modules/users/ProfilePage";
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
import { StudentFormEditor } from "./admin-studio/StudentFormEditor";
import { AdmissionFormEditor } from "./admin-studio/AdmissionFormEditor";
import { FeeStructureEditor } from "./admin-studio/FeeStructureEditor";
import { GradingScaleEditor } from "./admin-studio/GradingScaleEditor";
import { AcademicCalendarPage } from "./admin-studio/AcademicCalendarPage";
import { DashboardWidgetsEditor } from "./admin-studio/DashboardWidgetsEditor";
import { ReceiptTemplateEditor } from "./admin-studio/ReceiptTemplateEditor";
import { VtiSetupPage as _VtiSetupPage } from "./setup/VtiSetupPage"; // kept for platform admin
import { SetupClosedPage } from "./setup/SetupClosedPage";
import { PlatformAdminLayout } from "./platform-admin/PlatformAdminLayout";
import { PlatformOverview } from "./platform-admin/PlatformOverview";
import { PlatformTenantManager } from "./platform-admin/PlatformTenantManager";
import { ProvisionVtiPage } from "./platform-admin/ProvisionVtiPage";
import { PlatformUsersPage } from "./platform-admin/PlatformUsersPage";
import { DashboardPage } from "./modules/dashboard/DashboardPage";
import { LoginPage } from "./auth/LoginPage";
import { PlatformLoginPage } from "./auth/PlatformLoginPage";
import { ForgotPasswordPage } from "./auth/ForgotPasswordPage";
import { ResetPasswordPage } from "./auth/ResetPasswordPage";
import { VerifyTenantEmailPage } from "./auth/VerifyTenantEmailPage";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { RequireRole } from "./auth/RequireRole";
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
import ProcurementPage from "./modules/procurement/ProcurementPage";
import RequisitionCreatePage from "./modules/procurement/RequisitionCreatePage";
import RequisitionDetailPage from "./modules/procurement/RequisitionDetailPage";
import PurchaseOrderCreatePage from "./modules/procurement/PurchaseOrderCreatePage";
import PurchaseOrderDetailPage from "./modules/procurement/PurchaseOrderDetailPage";
import GRNCreatePage from "./modules/procurement/GRNCreatePage";
import GRNDetailPage from "./modules/procurement/GRNDetailPage";
import InventoryPage from "./modules/inventory/InventoryPage";
import InventoryItemCreatePage from "./modules/inventory/InventoryItemCreatePage";
import InventoryItemDetailPage from "./modules/inventory/InventoryItemDetailPage";
import IssuanceCreatePage from "./modules/inventory/IssuanceCreatePage";
import StockTakeCreatePage from "./modules/inventory/StockTakeCreatePage";
import StockTakeDetailPage from "./modules/inventory/StockTakeDetailPage";
import StockReceiptPage from "./modules/inventory/StockReceiptPage";
import { StudentProjectsListPage } from "./modules/student-projects/StudentProjectsListPage";
import { StudentProjectDetailPage } from "./modules/student-projects/StudentProjectDetailPage";
import { SRQListPage } from "./modules/stores/SRQListPage";
import { SRQDetailPage } from "./modules/stores/SRQDetailPage";
import { PCVListPage } from "./modules/stores/PCVListPage";
import { PCVDetailPage } from "./modules/stores/PCVDetailPage";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/platform-login",
    element: <PlatformLoginPage />,
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
    path: "/verify-tenant-email",
    element: <VerifyTenantEmailPage />,
  },
  {
    path: "/apply/:tenantSlug",
    element: <PublicApplicationPage />,
  },
  {
    path: "/setup",
    element: <SetupClosedPage />,
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
      { path: "users", element: <RequireRole roles={["admin"]}><UsersListPage /></RequireRole> },
      { path: "users/new", element: <RequireRole roles={["admin"]}><UserCreatePage /></RequireRole> },
      { path: "users/:id", element: <RequireRole roles={["admin"]}><UserDetailPage /></RequireRole> },
      { path: "my-profile", element: <ProfilePage /> },
      { path: "finance", element: <RequireRole roles={["admin", "finance", "principal"]}><FeesPage /></RequireRole> },
      { path: "finance/entry", element: <RequireRole roles={["admin", "finance", "principal"]}><FeeEntryPage /></RequireRole> },
      { path: "finance/import", element: <RequireRole roles={["admin", "finance", "principal"]}><FeesImportPage /></RequireRole> },
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
      { path: "staff", element: <RequireRole roles={["admin", "registrar", "hod", "principal"]}><StaffListPage /></RequireRole> },
      { path: "staff/new", element: <RequireRole roles={["admin", "principal"]}><StaffCreatePage /></RequireRole> },
      { path: "staff/:id", element: <RequireRole roles={["admin", "registrar", "hod", "principal"]}><StaffDetailPage /></RequireRole> },
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
      { path: "finance/reconciliation", element: <RequireRole roles={["admin", "finance", "principal"]}><SchoolPayReconciliationPage /></RequireRole> },
      { path: "finance/overview", element: <RequireRole roles={["admin", "finance", "principal"]}><FeeOverviewPage /></RequireRole> },
      { path: "finance/receipt", element: <RequireRole roles={["admin", "finance", "principal"]}><FeeReceiptPage /></RequireRole> },
      { path: "results", element: <ResultsPage /> },
      { path: "results/slip", element: <ResultsSlipPage /> },
      { path: "results/transcript", element: <TranscriptPage /> },
      { path: "clearance", element: <ClearancePage /> },
      { path: "procurement", element: <RequireRole roles={["admin", "procurement_officer", "principal"]}><ProcurementPage /></RequireRole> },
      { path: "procurement/requisitions/new", element: <RequireRole roles={["admin", "procurement_officer", "principal"]}><RequisitionCreatePage /></RequireRole> },
      { path: "procurement/requisitions/:id", element: <RequireRole roles={["admin", "procurement_officer", "principal"]}><RequisitionDetailPage /></RequireRole> },
      { path: "procurement/orders/new", element: <RequireRole roles={["admin", "procurement_officer", "principal"]}><PurchaseOrderCreatePage /></RequireRole> },
      { path: "procurement/orders/:id", element: <RequireRole roles={["admin", "procurement_officer", "principal"]}><PurchaseOrderDetailPage /></RequireRole> },
      { path: "procurement/grns/new", element: <RequireRole roles={["admin", "procurement_officer", "principal"]}><GRNCreatePage /></RequireRole> },
      { path: "procurement/grns/:id", element: <RequireRole roles={["admin", "procurement_officer", "principal"]}><GRNDetailPage /></RequireRole> },
      { path: "inventory", element: <RequireRole roles={["admin", "procurement_officer", "inventory_manager", "principal"]}><InventoryPage /></RequireRole> },
      { path: "inventory/items/new", element: <RequireRole roles={["admin", "procurement_officer", "inventory_manager", "principal"]}><InventoryItemCreatePage /></RequireRole> },
      { path: "inventory/items/:id", element: <RequireRole roles={["admin", "procurement_officer", "inventory_manager", "principal"]}><InventoryItemDetailPage /></RequireRole> },
      { path: "inventory/issuances/new", element: <RequireRole roles={["admin", "procurement_officer", "inventory_manager", "principal"]}><IssuanceCreatePage /></RequireRole> },
      { path: "inventory/receipts/new", element: <RequireRole roles={["admin", "procurement_officer", "inventory_manager", "principal"]}><StockReceiptPage /></RequireRole> },
      { path: "inventory/stock-takes/new", element: <RequireRole roles={["admin", "procurement_officer", "inventory_manager", "principal"]}><StockTakeCreatePage /></RequireRole> },
      { path: "inventory/stock-takes/:id", element: <RequireRole roles={["admin", "procurement_officer", "inventory_manager", "principal"]}><StockTakeDetailPage /></RequireRole> },
      { path: "student-projects", element: <StudentProjectsListPage /> },
      { path: "student-projects/:id", element: <StudentProjectDetailPage /> },
      { path: "stores/requisitions", element: <RequireRole roles={["admin", "procurement_officer", "inventory_manager", "principal"]}><SRQListPage /></RequireRole> },
      { path: "stores/requisitions/:id", element: <RequireRole roles={["admin", "procurement_officer", "inventory_manager", "principal"]}><SRQDetailPage /></RequireRole> },
      { path: "stores/pcv", element: <RequireRole roles={["admin", "procurement_officer", "inventory_manager", "principal"]}><PCVListPage /></RequireRole> },
      { path: "stores/pcv/:id", element: <RequireRole roles={["admin", "procurement_officer", "inventory_manager", "principal"]}><PCVDetailPage /></RequireRole> },
    ],
  },
  {
    path: "/platform-admin",
    element: (
      <ProtectedRoute>
        <RequireRole roles={["platform_admin"]}>
          <PlatformAdminLayout />
        </RequireRole>
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <PlatformOverview /> },
      { path: "tenants", element: <PlatformTenantManager /> },
      { path: "tenants/:id", element: <Navigate to="/platform-admin/tenants" replace /> },
      { path: "provision", element: <ProvisionVtiPage /> },
      { path: "users", element: <PlatformUsersPage /> },
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
      { path: "student-form", element: <StudentFormEditor /> },
      { path: "admission-form", element: <AdmissionFormEditor /> },
      { path: "fee-structure", element: <FeeStructureEditor /> },
      { path: "grading", element: <GradingScaleEditor /> },
      { path: "academic-calendar", element: <AcademicCalendarPage /> },
      { path: "dashboards", element: <DashboardWidgetsEditor /> },
      { path: "receipt-template", element: <ReceiptTemplateEditor /> },
    ],
  },
]);
