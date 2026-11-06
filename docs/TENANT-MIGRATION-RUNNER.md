# Tenant Migration Runner

This server-side runner moves an approved tenant between AMIS databases with
matching schemas. It is an operator tool, not a Platform Admin UI. The
destination tenant row must already exist. For a fresh local VTI whose default
tenant has no data to retain, `--adopt-source-identity` lets the approved
migration replace that tenant's slug and institute setup with the source
identity while retaining the local tenant ID and database.

## Safety model

- Read-only dry-run is the default. It starts a read-only repeatable-read
  transaction on the source and does not write to either database.
- Import requires `--apply`, source-pause and production-write confirmations,
  an institute approval reference, and a verified production-backup reference.
- Source and target must be different PostgreSQL databases, use elevated roles
  that bypass RLS, and have matching dbmate migration versions and table
  shapes. Every tenant-scoped table must be explicitly classified as included,
  excluded, or handled by the user/role mapper; an unclassified table stops the
  run.
- The destination tenant must be empty of business data. Existing destination
  users, if any, must match source users by case-insensitive email.
- Imports run in one target transaction and roll back on a failed insert or
  post-import count check. Referenced uploads are staged and SHA-256 checked;
  if the database commit result is uncertain, files are retained for manual
  reconciliation rather than risking broken references.
- Foreign-key dependencies determine insert order. Unresolved dependency cycles,
  missing user mappings, key collisions, or incompatible password hashes stop
  the run.

## Included and excluded records

The allowlist covers tenant configuration/history and settings, users/roles,
IAM and application audit history, academic/programme/course setup,
admissions, students, registrations, marks/results, fees/payments, attendance,
clearance, student documents/projects, alumni, field placements/industrial
training, staff/HR, workflows, notifications, procurement, inventory/stores,
assets, and other institute operations. Database-stored document bytes are
copied with their rows.

Only transient/system-security data is excluded: outbox and sync transport
events, refresh/reset/OTP tokens, and tenant-email verification tokens. Every
source user is matched or created by case-insensitive email; compatible
scrypt-format password hashes and account profiles are preserved. User IDs
are remapped wherever the migration knows a column refers to a user. Active
sessions are not migrated.

Tenant configuration values, including approved integration secrets, are
copied. The dry-run detects likely secret-bearing key names and prints only
their paths, never their values. If any are found, apply requires
`--confirm-secrets-reviewed`; an authorized operator must inspect/approve those
values in the secured source environment. Do not send secret values or
database URLs in chat, tickets, or logs.

Only files referenced by migrated rows or the institute logo are copied from
`SOURCE_UPLOADS_DIR` to `TARGET_UPLOADS_DIR`. Both directories must be
available to the migration process. The runner rejects unsafe paths, refuses
to overwrite destination files, stages copies, and verifies SHA-256 equality.
Never copy an entire uploads volume. If the hosted source and local VTI do not
share a secure migration host or mount, stop and establish an approved secure
file/database transfer path first.

The local tenant keeps its ID and active state. By default, its slug remains
unchanged. When `--adopt-source-identity` is explicitly supplied, the runner
also adopts the source slug; this is intended for replacing an unused local
default tenant such as `demovti` with the institute's real identity. Institute
name, contact details, logo reference, ownership/licensing, UVTAB, and setup
metadata come from the source tenant. Contact-email verification state and its
tokens are not transferred.

## Per-institute migration

1. Confirm institute approval, schedule the source write-pause, and create a
   verified backup of the destination. Keep users from writing to the source
   until the import and verification are complete.
2. Confirm the destination tenant is empty of data to retain. The migration
   uses its existing tenant row and ID; for a default tenant such as `demovti`,
   include `--adopt-source-identity` only when the institute explicitly wants
   that local tenant identity replaced. If the adopted tenant has no users,
   source accounts are created with their compatible password hashes; review
   the source account/role counts and ensure an active institute admin exists.
   Any pre-existing target users must match source users by email.
3. Confirm both database connections and, when referenced uploads exist, both
   upload directories are available only on the approved migration host.
   Never expose PostgreSQL publicly to make the connection work.
4. Run a dry-run and review every included/excluded count, account mapping,
   foreign-key ordering, collision, unmapped user reference, potential secret
   field path, and upload count. Stop if anything is unexpected.
5. Pause source writes, take a final source backup, and re-run the dry-run
   immediately before applying.
6. Only after reviewing the final dry-run, run the command with
   `--apply`, `--confirm-source-paused`, `--confirm-production-write`, a real
   approval reference, a verified backup reference, and
   `--confirm-secrets-reviewed` when secret-bearing fields are reported.
7. Validate all table counts, file references and representative institute
   workflows with the institute, obtain sign-off, then keep the source
   read-only for the agreed retention period.

## KTI hosted-to-local SSH route

The migration tooling is on branch `fix/uat-validated-20261014`; it is not part
of the VTI's pinned application release. On KTI, fetch the files into a
temporary directory without checking out the branch or changing the running
application:

```bash
cd /opt/amis/amis-multi-tenant
git fetch origin fix/uat-validated-20261014
MIGRATION_DIR=/tmp/amis-migration-56a3779
mkdir -m 700 "$MIGRATION_DIR"
git show 56a3779:scripts/migrate-tenant-data.mjs \
  > "$MIGRATION_DIR/migrate-tenant-data.mjs"
git show 56a3779:scripts/fetch-tenant-uploads-over-ssh.sh \
  > "$MIGRATION_DIR/fetch-tenant-uploads-over-ssh.sh"
git show origin/fix/uat-validated-20261014:docs/TENANT-MIGRATION-RUNNER.md \
  > "$MIGRATION_DIR/TENANT-MIGRATION-RUNNER.md"
```

Read the temporary runbook and use the exact migration commit. Stop if the
directory already exists rather than overwriting prior files.

The KTI VTI can initiate SSH to the hosted VPS. A read-only check confirmed
that the VPS host can reach the staging DB container on its private Docker
address. This permits an SSH local forward without publishing a PostgreSQL
port. Keep the SSH host key verification enabled and use the VPS's trusted SSH
host alias. Do not enable shell tracing while handling database URLs.

The runner executes inside the local API container, which can reach the local
database and uploads volume. Bind the SSH forward only to that Compose
network's gateway address so other hosts cannot connect to it. On the KTI VTI:

```bash
set -euo pipefail
cd /opt/amis/amis-multi-tenant
VPS_SSH=<trusted-vps-ssh-alias>
LOCAL_API=config-api-1
MIGRATION_DIR=/tmp/amis-migration-56a3779

local_network=$(sudo docker inspect --format '{{range $name, $value := .NetworkSettings.Networks}}{{println $name}}{{end}}' "$LOCAL_API" | head -n 1)
local_gateway=$(sudo docker network inspect --format '{{(index .IPAM.Config 0).Gateway}}' "$local_network")
[[ "$local_gateway" =~ ^[0-9.]+$ ]]

source_db_ip=$(ssh "$VPS_SSH" 'cd /opt/amis && db=$(sudo docker compose -p amis-staging -f docker-compose.staging.yml --env-file .env.staging ps -q db) && sudo docker inspect --format "{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}" "$db"')
[[ "$source_db_ip" =~ ^[0-9.]+$ ]]

# Keep this running in its own terminal. It listens only on the local Docker
# bridge gateway, and forwards through SSH to the private DB container IP.
ssh -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 \
  -N -L "${local_gateway}:15432:${source_db_ip}:5432" "$VPS_SSH"
```

In another KTI terminal, obtain the source API container ID and the database URL
without printing either value:

```bash
set -euo pipefail
umask 077
cd /opt/amis/amis-multi-tenant
VPS_SSH=<trusted-vps-ssh-alias>
LOCAL_API=config-api-1

local_network=$(sudo docker inspect --format '{{range $name, $value := .NetworkSettings.Networks}}{{println $name}}{{end}}' "$LOCAL_API" | head -n 1)
local_gateway=$(sudo docker network inspect --format '{{(index .IPAM.Config 0).Gateway}}' "$local_network")
[[ "$local_gateway" =~ ^[0-9.]+$ ]]
SOURCE_API=$(ssh "$VPS_SSH" 'cd /opt/amis && sudo docker compose -p amis-staging -f docker-compose.staging.yml --env-file .env.staging ps -q api')
[[ "$SOURCE_API" =~ ^[a-fA-F0-9]{12,64}$ ]]

SOURCE_DIR=/tmp/kti-source-uploads
sudo docker exec "$LOCAL_API" mkdir -m 700 "$SOURCE_DIR"
sudo docker cp "$MIGRATION_DIR/migrate-tenant-data.mjs" \
  "$LOCAL_API:/tmp/migrate-tenant-data.mjs"

run_migration() {
  local source_url
  source_url=$(ssh "$VPS_SSH" "sudo docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' $SOURCE_API | sed -n 's/^DATABASE_URL=//p'")
  test -n "$source_url"
  printf '%s\0%s' "$source_url" "$SOURCE_DIR" |
    sudo docker exec -i "$LOCAL_API" node -e '
      let input = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (chunk) => { input += chunk; });
      process.stdin.on("end", () => {
        const [sourceUrl, sourceDir] = input.split("\0");
        const url = new URL(sourceUrl);
        url.hostname = process.argv[1];
        url.port = "15432";
        process.stdout.write(JSON.stringify({
          SOURCE_DATABASE_URL: url.toString(),
          SOURCE_UPLOADS_DIR: sourceDir,
          TARGET_UPLOADS_DIR: "/app/apps/api/uploads"
        }));
      });
    ' "$local_gateway" |
    sudo docker exec -i "$LOCAL_API" sh -c 'umask 077; cat > /tmp/kti-migration.json'
  unset source_url
  sudo docker exec "$LOCAL_API" node --input-type=module -e '
    const fs = await import("node:fs/promises");
    const config = JSON.parse(await fs.readFile(process.argv[1], "utf8"));
    Object.assign(process.env, config);
    await fs.unlink(process.argv[1]);
    const { runMigration } = await import("file:///tmp/migrate-tenant-data.mjs");
    try {
      await runMigration(process.argv.slice(2), process.env);
    } catch (error) {
      console.error(`Tenant migration stopped: ${error.message}`);
      process.exitCode = 1;
    }
  ' /tmp/kti-migration.json "$@"
}

# Dry-run only. Review its output and manifest before transferring any files.
run_migration --source-slug=kti --target-slug=demovti \
  --adopt-source-identity --write-upload-manifest=/tmp/kti-upload-manifest.txt
```

Keep this migration terminal open. Use another terminal for the upload-fetch
steps below, then return here to repeat the dry-run and, after explicit review,
run the separately approved apply command.

The first run is a dry-run. It writes only referenced upload paths to the
private manifest inside the local API container. Copy that manifest to a
private, empty directory on the KTI host and fetch only those files from the
hosted API container:

```bash
umask 077
cd /opt/amis/amis-multi-tenant
VPS_SSH=<trusted-vps-ssh-alias>
LOCAL_API=config-api-1
MIGRATION_DIR=/tmp/amis-migration-56a3779
source_api=$(ssh "$VPS_SSH" 'cd /opt/amis && sudo docker compose -p amis-staging -f docker-compose.staging.yml --env-file .env.staging ps -q api')
manifest_dir=$(mktemp -d)
upload_dir=$(mktemp -d)
sudo docker cp "$LOCAL_API:/tmp/kti-upload-manifest.txt" "$manifest_dir/manifest.txt"
scp "$MIGRATION_DIR/fetch-tenant-uploads-over-ssh.sh" "$manifest_dir/fetch-uploads.sh"
bash "$manifest_dir/fetch-uploads.sh" "$VPS_SSH" "$source_api" \
  "$manifest_dir/manifest.txt" "$upload_dir"
sudo docker cp "$upload_dir/." "$LOCAL_API:/tmp/kti-source-uploads/"
```

The helper validates every path, copies only listed files over SSH, checks
SHA-256 against the source, and refuses to overwrite. Re-run the dry-run after
the files are staged and review all counts, secret-field paths, account
mappings, and collisions. Repeat the dry-run after staging files. For apply,
pause source writes, take verified backups, obtain Institute approval, and then
repeat the same `run_migration` call with `--apply`,
`--confirm-source-paused`, `--confirm-production-write`, real approval and
backup references, and `--confirm-secrets-reviewed` if prompted.
Keep the source write-paused and tunnel open through verification; remove the
specific temporary manifest, upload directory, and container files afterward.

After institute sign-off, cleanup the named temporary paths:

```bash
sudo docker exec "$LOCAL_API" rm -f /tmp/migrate-tenant-data.mjs /tmp/kti-upload-manifest.txt
sudo docker exec "$LOCAL_API" rm -rf /tmp/kti-source-uploads
rm -rf -- "$manifest_dir" "$upload_dir"
rm -rf -- /tmp/amis-migration-56a3779
```

This procedure must first be tested against a sanitized clone. The source URL
contains a database credential and is read from the API container over SSH;
keep shell tracing off, never print the value, and delete the temporary env
file/container copy immediately after each run.

## Same-VPS alternative

If both databases and upload volumes are on the same controlled VPS, a runner
can instead be attached to both private Compose networks and mount only the
referenced files. Do not use this variation for the separate local KTI target.

An apply run uses the same sequence, with the script arguments changed to:

```text
--source-slug=source-tenant-slug
--target-slug=target-tenant-slug
--apply
--confirm-source-paused
--confirm-production-write
--approval-reference=<institute approval reference>
--backup-reference=<verified production backup reference>
--confirm-secrets-reviewed
--adopt-source-identity
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
