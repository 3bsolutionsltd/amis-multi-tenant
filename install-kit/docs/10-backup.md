# 10. Backup & Restore

## 10.1 Scheduled daily backup

`scripts/backup.sh` writes a gzipped `pg_dump` into `backups/` and prunes anything older than `RETENTION_DAYS` (default 30).

Schedule with cron at 01:00:

```bash
sudo crontab -e
# Add:
0 1 * * *  /opt/amis/install-kit/scripts/backup.sh >> /var/log/amis-backup.log 2>&1
```

Windows Task Scheduler equivalent:

```powershell
schtasks /Create /SC DAILY /TN "AMIS Backup" /TR "C:\amis\install-kit\scripts\backup.sh" /ST 01:00
```

> **Always copy backups off the server** — USB, second internal disk, network share, secondary VTI server. A backup that lives only on the same disk as the database is not a backup.

## 10.2 Restore from backup

```bash
./scripts/restore.sh backups/amis-2026-05-21_0100.sql.gz
# You will be prompted to type RESTORE to confirm.
```

The script stops API/Web, drops + recreates the database, restores the dump, and starts the stack again.

## 10.3 Backing up uploads

The API writes uploaded files (student photos, attachments) into the `uploads` Docker volume.

```bash
docker run --rm \
  -v amis_uploads:/data \
  -v "$PWD/backups:/backup" \
  alpine tar czf /backup/uploads-$(date +%F).tgz -C /data .
```

## 10.4 Disaster-recovery drill

Quarterly: restore the latest backup on a **separate** machine and verify the data. Never test restore over a live production database.
