# Copilot/Agent Rules (Must Follow)

1. Every business table must have `tenant_id uuid not null`.
2. Enable RLS + policies for every `app.*` tenant-scoped table.
3. Every API request that touches DB must run in a transaction that sets:
   - `SET LOCAL app.tenant_id = $1`
4. Do not add new frameworks unless explicitly requested.
5. Keep code modular:
   - apps/api/src/modules/<module>
   - apps/api/src/engines/<engine>
6. Add tests for RLS isolation and workflow transition validation.
7. For early dev, allow `x-tenant-id` header (temporary), later switch to JWT tenant claims.