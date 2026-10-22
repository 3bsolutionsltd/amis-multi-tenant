# 4. Pre-Install Checklist

Tick every item before running the installer.

- [ ] Server hardware meets [requirements](03-requirements.md) and is racked, powered, on the LAN.
- [ ] Stable LAN IP or hostname allocated and recorded — e.g. `192.168.1.100` or `amis.kti.local`.
- [ ] Docker installed: `docker --version` and `docker compose version` both work.
- [ ] You have the full **install-kit** folder (USB drive or download). It contains:
  - `install.sh`
  - `config/docker-compose.offline.yml`
  - `config/.env.offline.example`
  - `scripts/` (backup, restore, healthcheck, serve-docs, …)
  - `docs/` (this site)
  - `db/migrations/` and `images/postgres.tar`, `amis-api.tar`, `amis-web.tar`, `dbmate.tar`
- [ ] Verified the install kit ZIP against its accompanying SHA-256 checksum file.
- [ ] Backup destination agreed (local disk path, external drive, NAS).
- [ ] UPS connected.

If anything is missing, **do not proceed** — use the AMIS support channel specified for your institution.
