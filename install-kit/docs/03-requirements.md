# 3. Requirements

## Server hardware

| Resource | Minimum | Recommended | Notes |
|----------|---------|-------------|-------|
| CPU | 2 cores | 4+ cores | x86-64; no GPU. |
| RAM | 4 GB | 8 GB | Postgres + Node.js + Nginx. |
| Disk | 40 GB SSD | 120 GB SSD | Allow growth for records, uploads, backups. |
| Network | 100 Mb LAN | 1 Gb LAN | Internet not required after install. |
| UPS | Recommended | Strongly recommended | Prevents DB corruption on power loss. |

## Server operating system

Any **one** of:

- Ubuntu Server 22.04 LTS (recommended)
- Debian 12
- Windows Server 2019 / 2022 (Docker Engine or Docker Desktop)

## Required server software

| Software | Version | Purpose |
|----------|---------|---------|
| Docker Engine | 24+ | Runs the four AMIS containers |
| Docker Compose plugin | v2+ | Orchestration |
| `bash` or PowerShell 5+ | — | Helper scripts |
| Node.js 20 (optional) | — | Only for running data-import scripts on the server |

> **AMIS does not ship Docker.** If your server has no internet, install Docker first using offline `.deb` / `.msi` packages from your distro / Microsoft.

## Client devices

- Any modern browser: Chrome, Edge, Firefox (last 2 versions), Safari 16+.
- No client install needed — AMIS is a web app.
- Client must be on the same LAN as the server (offline mode) or reachable over the internet (cloud mode).

## Network

- A **static LAN IP** on the AMIS server (e.g. `192.168.1.100`). This IP **must not change** after install — it is baked into the web bundle.
- Optional: a LAN DNS name (e.g. `amis.kti.local`) on the institution's router. Recommended if the server may ever move IP.
