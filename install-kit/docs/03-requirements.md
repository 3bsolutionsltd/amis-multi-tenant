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

The first supported release targets:

- Ubuntu Server 22.04 LTS, x86-64.

## Required server software

| Software | Version | Purpose |
|----------|---------|---------|
| Docker Engine | 24+ | Runs the four AMIS containers |
| Docker Compose plugin | v2+ | Orchestration |
| Bash, `curl`, `openssl`, `tar` | Ubuntu packages | Installer and operations scripts |
| Python 3 | Ubuntu package (optional) | Serves the documentation site on the LAN |

> **AMIS does not include the Docker Engine installer.** Install and verify Docker Engine and the Compose plugin before transferring the AMIS kit to a server that has no internet access.

## Client devices

- Any modern browser: Chrome, Edge, Firefox (last 2 versions), Safari 16+.
- No client install needed — AMIS is a web app.
- Client must be connected to the institution's LAN.

## Network

- Assign a stable LAN IP or DNS name to the AMIS server (e.g. `192.168.1.100` or `amis.kti.local`) and use it consistently in staff browsers.
- The kit's Web image resolves the API host from the browser URL at runtime; the server address is not baked into the image.
- Keep ports 80 and 3001 reachable only from the institution's LAN. Do not expose them directly to the internet.
