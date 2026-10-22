# Welcome

This manual describes the supported Ubuntu Server self-hosted installation for one institution per server.

Use the sidebar (or the search bar) to navigate.

Start with **[Offline install](05-install-offline.md)** for a disconnected server, or [Connected VTI install](06-install-cloud.md) when the server can reach GHCR. Then continue to [first login](07-first-login.md) and [validation](08-validate.md).

## At a glance

| Task | Where to look |
|------|----------------|
| First-time install | [05 — Offline install](05-install-offline.md) |
| Connected VTI install | [06 — Connected VTI install](06-install-cloud.md) |
| Daily ops | [12 — Operations](12-operations.md) |
| Something broken | [13 — Troubleshooting](13-troubleshooting.md) |
| Apply an update | [09 — Updating](09-update.md) |
| Disaster recovery | [10 — Backup & restore](10-backup.md) |

## Serve these docs on your LAN

Run **once** on the AMIS server so everyone in the institution reads the same documentation:

```bash
./scripts/serve-docs.sh
```

Then bookmark `http://<server-ip>:4001` on every staff workstation.
