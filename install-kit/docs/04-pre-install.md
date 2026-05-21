# 4. Pre-Install Checklist

Tick every item before running the installer.

- [ ] Server hardware meets [requirements](03-requirements.md) and is racked, powered, on the LAN.
- [ ] Static LAN IP allocated and recorded — e.g. `192.168.1.100`.
- [ ] Docker installed: `docker --version` and `docker compose version` both work.
- [ ] You have the full **install-kit** folder (USB drive or download). It contains:
  - `install.sh` / `install.ps1`
  - `config/docker-compose.offline.yml`
  - `config/.env.offline.example`
  - `scripts/` (backup, restore, healthcheck, serve-docs, …)
  - `docs/` (this site)
  - `images/postgres.tar`, `amis-api.tar`, `amis-web.tar`, `dbmate.tar`
- [ ] Verified checksum of the install kit ZIP against the `sha256` file from 3B Solutions.
- [ ] Platform-admin credentials received from 3B Solutions (on a separate, secure channel).
- [ ] Backup destination agreed (local disk path, external drive, NAS).
- [ ] UPS connected.

If anything is missing, **do not proceed** — contact 3B Solutions Ltd.
