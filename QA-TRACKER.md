# AMIS QA Issue Tracker
_Last updated: 2026-05-07_

Source: QA test session feedback from user.

---

## Status Legend
| Symbol | Meaning |
|--------|---------|
| ✅ | Fixed / Implemented |
| ⏳ | In Progress |
| ❌ | Pending |
| ℹ️ | Confirmed working — no fix needed |

---

## Bug Fixes

| # | Issue | Status | Notes |
|---|-------|--------|-------|
| 1 | **Reset Password → API Error 400** | ✅ Fixed | Field name mismatch (`new_password` → `newPassword`). Added uppercase + digit client-side validation. |
| 2 | **Forgot Password → API Error** | ✅ Fixed | Backend now accepts `tenantSlug` and resolves it to a tenant UUID. UI sends institution code. Returns 200 on unknown slug (prevents enumeration). |
| 3 | **User access not aligned with permission matrix — all users act like admin** | ✅ Fixed | Created `RequireRole` component. Applied role guards to sensitive routes: `/users` (admin only), `/finance` (finance/admin/principal), `/staff` (admin/registrar/hod/principal), `/procurement` + `/inventory` + `/stores` (procurement_officer/inventory_manager/admin/principal), `/platform-admin` (platform_admin only). |
| 4 | **User Management — full names not captured** | ✅ Fixed | DB migration adds `first_name` + `last_name` columns. API + create/list UI updated. Name shown in list with email as subtitle. |
| 5 | **Navigation Editor — Add Item has no response when clicked** | ✅ Fixed | Removed `disabled` state from button. Added validation hint showing which field is missing when form is incomplete. |
| 6 | **Module Toggles — toggled modules still appear** | ✅ Fixed | `ConfigProvider` now surfaces `enabledModules`. `AppShell` sidebar filters nav items using `ROUTE_MODULE` map. |
| 7 | **Module Toggles — procurement/inventory/stores modules missing** | ✅ Fixed | Added "Operations & Procurement" group with Procurement, Inventory, Stores/SRQ, Student Projects entries. Config schema widened from 3-key object to `Record<string, boolean>` (Zod was stripping unknown keys). |
| 8 | **Admin Studio — Student/Admission form config doesn't save correctly** | ✅ Fixed | Config schema now includes `admissions` form config. Frontend `ConfigPayload` type updated. |
| 9 | **User Deactivation** | ℹ️ Working | No fix needed. |
| 10 | **Admissions — New Application button** | ℹ️ Working | No fix needed. |
| 11 | **Registrar can't access Admin Studio** | ℹ️ Working correctly | Registrar is intentionally blocked from Admin Studio (admin-only). |

---

## Feature Requests

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| F1 | **New Student form — tabbed layout** (Bio Data / Placement / NOK / UVTAB) | ✅ Implemented | StudentCreatePage converted to 4-tab layout. All data submitted in one action. |
| F2 | **Programmes — select from TVET catalogue** | ✅ Implemented | "Browse Catalogue" button opens searchable modal with Uganda TVET standard programmes. Selecting one pre-fills the New Programme form. |
| F3 | **Import students (already registered)** | ✅ Implemented | Import page now shows a clear warning when a student's admission number already exists, with option to skip or update. Backend upsert mode supported via `update_if_exists` flag. |
| F4 | **Workflow configuration UX** | ✅ Improved | Added guided explanation panel, visual state diagram preview, and inline help tooltips to WorkflowViewer. |

---

## Pending / Future

| # | Item | Notes |
|---|------|-------|
| P1 | TVET accreditation fields on programmes (`accreditation_status`, `intake_capacity`) | From TVET-COVE-REQUIREMENTS.md — DB migration needed |
| P2 | Student `entry_qualification` and explicit `admission_date` fields | From TVET-COVE-REQUIREMENTS.md |
| P3 | Document upload for licenses, accreditation certificates | Future module |
| P4 | Board governance module (meeting logs, resolutions) | Low priority |
| P5 | Platform-level licence/accreditation fields on tenants | Requires platform migration |

---

## Files Changed (this QA cycle)

### Backend (`apps/api`)
| File | Change |
|------|--------|
| `src/modules/auth/auth.routes.ts` | Forgot-password accepts `tenantSlug`; resolves slug → UUID |
| `src/modules/config/config.schema.ts` | `modules` → `Record<string, boolean>`; added `admissions` to `forms` |
| `src/modules/users/users.routes.ts` | `first_name` / `last_name` in create/update/list |
| `db/migrations/20260429000062_users_name_fields.sql` | Adds `first_name`, `last_name` to `platform.users` |

### Frontend (`apps/web`)
| File | Change |
|------|--------|
| `src/auth/ResetPasswordPage.tsx` | Field name fix + client validation |
| `src/auth/ForgotPasswordPage.tsx` | Sends `tenantSlug`; institution code input |
| `src/auth/RequireRole.tsx` | **New** — role-based route guard component |
| `src/routes.tsx` | Applied `RequireRole` to sensitive routes |
| `src/app/ConfigProvider.tsx` | `enabledModules`, `admissions` form config |
| `src/app/AppShell.tsx` | Sidebar filters nav by `enabledModules` via `ROUTE_MODULE` map |
| `src/admin-studio/ModuleToggles.tsx` | Added Operations & Procurement group |
| `src/admin-studio/NavigationEditor.tsx` | Add Item validation hint |
| `src/modules/users/users.api.ts` | `firstName` / `lastName` in types |
| `src/modules/users/UserCreatePage.tsx` | First/Last name inputs |
| `src/modules/users/UsersListPage.tsx` | Shows name in list |
| `src/modules/students/StudentCreatePage.tsx` | Tabbed layout (Bio / Placement / NOK / UVTAB) |
| `src/modules/programmes/ProgrammesListPage.tsx` | Browse TVET Catalogue modal |
