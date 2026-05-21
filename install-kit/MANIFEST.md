# AMIS Install Kit — Bundle Manifest

> **Vendor checklist.** This file lists everything that **must be present** in `install-kit/` before the bundle is zipped and shipped to a VTI.

## Required files (vendor populates)

- [ ] `images/postgres.tar`         — `docker save amis-postgres:offline -o images/postgres.tar`
- [ ] `images/amis-api.tar`         — built from `apps/api/Dockerfile`
- [ ] `images/amis-web.tar`         — built from `apps/web/Dockerfile` with `VITE_API_URL` baked in
- [ ] `images/dbmate.tar`           — `docker save amis-dbmate:offline -o images/dbmate.tar`
- [ ] `db/migrations/*.sql`         — copy of latest `db/migrations/`
- [ ] `db/data-migration/<institution>/` — institution-specific seed scripts (if applicable)
- [ ] `docs/vendor/docsify.min.js`  — `curl -L https://cdn.jsdelivr.net/npm/docsify@4/lib/docsify.min.js -o docs/vendor/docsify.min.js`
- [ ] `docs/vendor/vue.css`         — `curl -L https://cdn.jsdelivr.net/npm/docsify@4/lib/themes/vue.css -o docs/vendor/vue.css`
- [ ] `docs/vendor/prism-bash.min.js` — `curl -L https://cdn.jsdelivr.net/npm/prismjs@1/components/prism-bash.min.js -o docs/vendor/prism-bash.min.js`

Run `scripts/prepare-offline-docs.sh` on the build machine to fetch all `vendor/` assets automatically.

## Always present (already in the kit)

- [x] `README.md`
- [x] `QUICK-START.md`
- [x] `install.sh`, `install.ps1`
- [x] `config/docker-compose.offline.yml`
- [x] `config/.env.offline.example`
- [x] `scripts/*` (backup, restore, healthcheck, serve-docs, load-images, diagnostics, prepare-offline-docs)
- [x] `docs/*.md` and `docs/index.html`

## Versioning

Add a `VERSION` file to the root before shipping:

```
echo "3.0.0+2026.05.21" > VERSION
```

## Build & ship

```bash
# From repo root
./scripts/build-offline-bundle.ps1 -ServerIp 192.168.1.100
zip -r amis-install-kit-$(cat install-kit/VERSION).zip install-kit/
sha256sum amis-install-kit-*.zip > install-kit-checksum.txt
```

Ship the `.zip` and the `.txt` checksum on the same USB / cloud upload.
