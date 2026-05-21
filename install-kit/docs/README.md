# Welcome

This is the **single source of truth** for installing and running AMIS at your institution.

Use the sidebar (or the search bar) to navigate.

If you only have 5 minutes, read **[Quick Start](../QUICK-START.md)** and then **[Offline install](05-install-offline.md)**.

## At a glance

| Task | Where to look |
|------|----------------|
| First-time install | [05 — Offline install](05-install-offline.md) |
| Daily ops | [12 — Operations](12-operations.md) |
| Something broken | [13 — Troubleshooting](13-troubleshooting.md) |
| Apply an update | [09 — Updating](09-update.md) |
| Disaster recovery | [10 — Backup & restore](10-backup.md) |

## Serve these docs on your LAN

Run **once** on the AMIS server so everyone in the institution reads the same documentation:

```bash
./scripts/serve-docs.sh           # Linux
.\scripts\serve-docs.ps1          # Windows
```

Then bookmark `http://<server-ip>:4001` on every staff workstation.
