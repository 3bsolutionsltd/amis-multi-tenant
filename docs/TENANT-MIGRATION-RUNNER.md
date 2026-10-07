# Tenant Migration Runner

This server-side runner moves an approved tenant between AMIS databases with
matching schemas. It is an operator tool, not a Platform Admin UI. It does not
create tenants: each destination tenant must first be created through the
approved **Provision New VTI** workflow.

## Safety model

- Read-only dry-run is the default. It starts a read-only repeatable-read
  transaction on the source and does not write to either database.
- Import requires `--apply`, source-pause and production-write confirmations,
  an institute approval reference, and a verified production-backup reference.
- Source and target must be different PostgreSQL databases, use elevated roles
  that bypass RLS, and have matching dbmate migration versions and table
  shapes.
- The destination must be newly provisioned and contain no imported data.
  Existing users must all match source users by case-insensitive email.
- Imports run in one target transaction and roll back on a failed insert or
  post-import count check.
- The allowlist is intentionally explicit. Review it before any production
  import and do not add a table without checking learner links and foreign keys.

## Included and excluded records

Included records cover institute configuration/history, settings, users/roles,
IAM audit history, academic/programme/course setup, grading/fee configuration,
staff/HR, instructor reports, procurement, inventory/stores, assets, and
non-student operations.

Student/admissions/registration/marks/payment/attendance/clearance/training
records and their workflows/audits are explicitly excluded, as are
notifications, sync/outbox events, password/reset/refresh tokens, and OTP or
contact-verification tokens. IAM audit user IDs are remapped to production
accounts. Staging password hashes and last-login data are never copied.

The runner preserves IDs for included non-user rows after checking for
destination collisions. User IDs are mapped by email. New production users
receive a newly generated random password hash and must use the production
password-reset flow. The provisioned initial admin keeps its production
password-setup credentials.

If an included record refers to `/uploads/...`, the runner reports the
references and refuses to apply. File transfer must be reviewed separately;
never copy the complete uploads volume because it may contain learner files.
The provisioning form's contact/name/address details remain authoritative.
Tenant licensing/ownership/UVTAB/setup metadata is copied, but staging contact
verification state is not.

## St Simon first migration

1. Confirm institute approval, schedule the source write-pause, and create a
   verified production database backup.
2. Provision `st-simon-peters` through **Provision New VTI**. Use an existing
   St Simon admin email so the provisioned production user maps to that source
   identity. Keep institute users out of the new tenant until migration
   completes.
3. Place this repository version on the VPS at `/opt/amis`. The source and
   target API and DB containers must be running. Run the operator commands in
   the next section from `/opt/amis`.
4. Run a dry-run and review every count, excluded-table count, user mapping
   total, key-collision count, audit reference count, and upload reference.
   Stop if the report differs from the approved scope.
5. Pause St Simon writes in staging and make a final backup/snapshot. Re-run
   the dry-run immediately before applying.
6. Only after reviewing the final dry-run, run the same command with
   `--apply`, `--confirm-source-paused`, `--confirm-production-write`, a real
   approval reference, and a verified backup reference.
7. Validate production counts and application behavior with St Simon, obtain
   sign-off, then keep staging read-only for the agreed retention period.

## Secure VPS invocation

The production and staging databases are on separate private Compose networks.
The following Bash pattern creates a short-lived runner container connected to
both networks, takes database URLs from the already-running API containers,
rewrites only the internal DB hostname, and removes the container and temporary
environment file on exit. It does not print the URLs. Run it as a trusted VPS
operator; Docker temporarily stores these URLs in the runner container's
environment metadata until cleanup.

```bash
cd /opt/amis
set -eu
umask 077

staging_api=$(docker compose -p amis-staging -f docker-compose.staging.yml --env-file .env.staging ps -q api)
production_api=$(docker compose -p amis -f docker-compose.prod.yml --env-file .env ps -q api)
staging_db=$(docker compose -p amis-staging -f docker-compose.staging.yml --env-file .env.staging ps -q db)
production_db=$(docker compose -p amis -f docker-compose.prod.yml --env-file .env ps -q db)
test -n "$staging_api" && test -n "$production_api"
test -n "$staging_db" && test -n "$production_db"

staging_db_name=$(docker inspect --format '{{.Name}}' "$staging_db" | sed 's#^/##')
production_db_name=$(docker inspect --format '{{.Name}}' "$production_db" | sed 's#^/##')
staging_network=$(docker inspect --format '{{range $name, $net := .NetworkSettings.Networks}}{{println $name}}{{end}}' "$staging_db" | head -n 1)

source_url=$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$staging_api" | sed -n 's/^DATABASE_URL=//p')
target_url=$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$production_api" | sed -n 's/^DATABASE_URL=//p')
test -n "$source_url" && test -n "$target_url"
source_url=${source_url/@db:5432/@${staging_db_name}:5432}
target_url=${target_url/@db:5432/@${production_db_name}:5432}

runner="amis-tenant-migration-$$"
envfile=$(mktemp)
cleanup() {
  docker rm -f "$runner" >/dev/null 2>&1 || true
  rm -f "$envfile"
  unset source_url target_url
}
trap cleanup EXIT
printf 'SOURCE_DATABASE_URL=%s\nTARGET_DATABASE_URL=%s\n' "$source_url" "$target_url" > "$envfile"
unset source_url target_url

docker create --name "$runner" --network amis_default --env-file "$envfile" \
  --entrypoint node amis-api /tmp/migrate-tenant-data.mjs \
  --source-slug=st-simon-peters --target-slug=st-simon-peters
docker network connect "$staging_network" "$runner"
docker cp scripts/migrate-tenant-data.mjs "$runner:/tmp/migrate-tenant-data.mjs"
docker start -ai "$runner"
```

The dry-run should print counts only, not user emails or record contents. Do not
share database URLs or `.env` contents. If the Compose project names, container
image, or networks differ, stop and adjust the operator invocation rather than
guessing.

An apply run uses the same sequence, with the script arguments changed to:

```text
--source-slug=st-simon-peters
--target-slug=st-simon-peters
--apply
--confirm-source-paused
--confirm-production-write
--approval-reference=<institute approval reference>
--backup-reference=<verified production backup reference>
```

Do not put credentials in arguments, shell history, screenshots, or chat. The
runner's environment variables must be populated only inside the secured VPS
shell/container context.

## Reusing for the remaining VTIs

Run one tenant at a time. For each VTI, repeat provisioning, source pause,
backup, dry-run review, apply, reconciliation, and institute sign-off. Do not
bulk-restore the staging database or run multiple tenant imports in parallel.
Record the approved source/target slugs, approval and backup references, dry-run
report, apply result, and sign-off for each VTI.
