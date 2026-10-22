# AMIS Installation Kit

**Version:** See the `VERSION` file in the release bundle
**Audience:** VTI technical staff
**Support target:** Ubuntu Server 22.04 LTS, x86-64; one institute per installation

The versioned release bundle generated from this source folder is a **complete, self-contained installation kit** for AMIS on Ubuntu Server. It includes the runtime images, migrations, installer, operations scripts, and documentation needed to install, run, back up, and maintain AMIS at your institution.

---

## 🎯 Start here

You have **two** ways to read the documentation. Pick one:

### Option 1 — Read the Markdown files
Open any file under `docs/` in a text editor. The numbering tells you the order.

### Option 2 — Serve the docs on your LAN (recommended)
With Python 3 installed on the server, run one script. Every staff member can then read the docs from any laptop on the LAN.

```bash
./scripts/serve-docs.sh           # then visit http://<server-ip>:4001
```

---

## ⚡ Just install it (TL;DR)

```bash
# Ubuntu Server
sudo ./install.sh
```

The script will:

1. Verify Docker is installed.
2. Load all Docker images from `images/*.tar`.
3. Create `config/.env.offline` interactively (asks for the server address and generates secrets).
4. Apply database migrations.
5. Start the stack.
6. Verify the services and print the local institute setup URL.

For step-by-step manual installation, see [docs/05-install-offline.md](docs/05-install-offline.md).

---

## 📦 What's in this kit?

| Folder / file | Purpose |
|---------------|---------|
| `README.md` | This file — start here. |
| `QUICK-START.md` | 1-page printable cheat-sheet. |
| `MANIFEST.md` | Required-file checklist for the versioned release bundle. |
| `install.sh` | One-command Ubuntu Server installer. |
| `config/docker-compose.offline.yml` | Container orchestration file for disconnected servers. |
| `config/docker-compose.online.yml` | Container orchestration file for servers that can pull release images. |
| `config/.env.offline.example` | Environment variable template for offline installs. |
| `config/.env.online.example` | Environment variable template for connected installs. |
| `scripts/` | Supported Ubuntu Bash scripts for backup, restore, health checks, documentation, and image loading. |
| `docs/` | Full **web-based** documentation (Docsify) and the Markdown source files. |
| `images/` | Docker images (`.tar` files) included in a release bundle. |

---

## 🆘 If something goes wrong

1. Read [docs/13-troubleshooting.md](docs/13-troubleshooting.md).
2. Collect diagnostics:
   ```bash
   ./scripts/diagnostics.sh > diag.txt
   ```
3. Send `diag.txt` through the AMIS support channel specified for your institution.

---
