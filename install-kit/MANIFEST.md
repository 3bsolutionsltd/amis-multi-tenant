# Self-Hosted Release Bundle Manifest

The release builder creates the installable archive from a clean, version-tagged checkout. The generated archive is complete only when it contains every item below.

## Required package contents

- `VERSION` — kit release version.
- `RELEASE-MANIFEST.json` — source commit, release tag, target platform, migration range, and image archive checksums.
- `install.sh` — supported Ubuntu Server installer.
- `config/docker-compose.offline.yml` and `config/.env.offline.example`.
- `db/migrations/*.sql` — all database migrations for the release.
- `images/postgres.tar`, `images/amis-api.tar`, `images/amis-web.tar`, and `images/dbmate.tar`.
- `scripts/` — supported Bash operations tools.
- `docs/` — installation and operations documentation.
- `docs/vendor/` — documentation assets required for offline viewing.

## Release checks

- Build from a clean checkout at the exact release tag.
- Verify every required image, migration, and offline documentation asset is present.
- Verify the generated archive against its `.sha256` file.
- Confirm that no institution data, generated secrets, or site-specific environment files are included.
- Complete the clean-server installation and acceptance checklist before distribution.

The build command and package layout are maintained in the repository-root `scripts/build-offline-bundle.ps1`.
