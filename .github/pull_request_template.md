## 📝 Linked Issue / Requirement
<!-- ISO 9001:2015 Clause 8.2 & 8.3 - Ensures traceability back to verified customer or product requirements -->
* Closes # <!-- Enter the GitHub Issue number here (e.g., #104) -->
* **Impacted Tenant / Platform:** <!-- e.g., SchoolBox, TransConnect, Core Infrastructure, Multi-tenant Shared Module -->

## 🔍 Description of Changes
<!-- A brief summary of what was built or fixed to give the reviewer technical context -->

## 🛡️ Risk Assessment & Verification
<!-- ISO 9001:2015 Clause 6.1 & 8.5.1 - Demonstrates risk-based thinking and control of changes -->
* **Risk Level of Change:** [ ] Low (UI fix, documentation) | [ ] Medium (Feature addition) | [ ] High (Database migration, auth/security update)
* **Rollback Plan:** <!-- Briefly state the fallback strategy if this deployment fails in production (e.g., "Revert commit", "DB backup restore points available") -->

## ✅ Quality Control Checklist
<!-- ISO 9001:2015 Clause 8.5 & 8.6 - Evidence of verification and validation prior to release -->
*Please check the items that apply to this PR before assigning a reviewer:*

### Engineering Quality
- [ ] Code follows project architecture patterns and linting rules.
- [ ] Automated tests (unit/integration) pass successfully (or N/A).
- [ ] Environment variables and configuration parameters have been updated across target environments.

### Security & Compliance
- [ ] No hardcoded API keys, secrets, or sensitive credentials are present in the code.
- [ ] Multi-tenant data isolation logic has been verified (no cross-tenant data leaks possible).
- [ ] Dependencies have been scanned for known vulnerabilities.

### Validation & Testing
- [ ] Local testing / Staging verification completed successfully.
- [ ] User Acceptance Criteria defined in the linked issue have been met.