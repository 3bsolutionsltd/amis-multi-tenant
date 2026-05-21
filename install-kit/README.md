# AMIS Installation Kit

**Version:** 1.0 · **Audience:** VTI technical staff
**For:** Academic Management Information System (AMIS) v3.0
**Vendor:** 3B Solutions Ltd.

This folder is a **complete, self-contained installation kit** for AMIS. Everything you need to install, run, back up, and maintain AMIS at your institution is inside.

---

## 🎯 Start here

You have **three** ways to read the documentation. Pick one:

### Option 1 — Open the docs in your browser (recommended)
Double-click `docs/index.html`. A full web documentation site opens. It works **offline**.

### Option 2 — Serve the docs on your LAN (best for teams)
Run one script. Every staff member can then read the docs from any laptop on the LAN.

```bash
# Linux / macOS
./scripts/serve-docs.sh           # then visit http://<server-ip>:4001
```
```powershell
# Windows
.\scripts\serve-docs.ps1          # then visit http://<server-ip>:4001
```

### Option 3 — Read the markdown files directly
Open any file under [docs/](docs/) in a text editor or on GitHub. The numbering tells you the order.

---

## ⚡ Just install it (TL;DR)

```bash
# Linux
sudo ./install.sh
```
```powershell
# Windows (PowerShell as Administrator)
.\install.ps1
```

The script will:

1. Verify Docker is installed.
2. Load all Docker images from `images/*.tar`.
3. Create `config/.env.offline` interactively (asks you for IP, generates passwords).
4. Apply database migrations.
5. Start the stack.
6. Run a health check and print the URL to open in a browser.

For step-by-step manual installation, see [docs/05-install-offline.md](docs/05-install-offline.md).

---

## 📦 What's in this kit?

| Folder / file | Purpose |
|---------------|---------|
| `README.md` | This file — start here. |
| `QUICK-START.md` | 1-page printable cheat-sheet. |
| `MANIFEST.md` | Checklist of files the vendor (3B Solutions) places in the bundle before shipping. |
| `install.sh` / `install.ps1` | One-command installer. |
| `config/docker-compose.offline.yml` | Container orchestration file. |
| `config/.env.offline.example` | Environment variable template (copy → `.env.offline`). |
| `scripts/` | Helper scripts (backup, restore, health-check, doc-server, image loaders). |
| `docs/` | Full **web-based** documentation (Docsify). Open `docs/index.html`. |
| `images/` | Docker images (`.tar` files) — populated by the vendor before shipping. |

---

## 🆘 If something goes wrong

1. Read [docs/13-troubleshooting.md](docs/13-troubleshooting.md).
2. Collect diagnostics:
   ```bash
   ./scripts/diagnostics.sh > diag.txt
   ```
3. Email **support@3bsolutions.co.ug** and attach `diag.txt`.

---

© 2026 3B Solutions Ltd.
