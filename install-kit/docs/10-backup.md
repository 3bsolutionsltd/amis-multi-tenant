# 10. Backup & Restore

## 10.1 Scheduled daily backup

`scripts/backup.sh` writes two matched files into `backups/`: a gzipped PostgreSQL dump and a compressed copy of uploaded files. Both files share a timestamp. The script verifies each archive and prunes files older than `RETENTION_DAYS` (default 30).

Schedule with cron at 01:00:

```bash
sudo crontab -e
# Add:
0 1 * * *  /opt/amis/install-kit/scripts/backup.sh >> /var/log/amis-backup.log 2>&1
```

> **Always copy backups off the server** — USB, second internal disk, network share, secondary VTI server. A backup that lives only on the same disk as the database is not a backup.

## 10.2 Restore from backup

```bash
./scripts/restore.sh \
  backups/amis-2026-05-21_010000.sql.gz \
  backups/amis-2026-05-21_010000-uploads.tar.gz
# Both files must have the same timestamp. You will be prompted to type RESTORE.
```

The script stops API/Web, recreates the database, restores the database and upload files, and starts the stack again. Run the health check before returning AMIS to service.

## 10.3 Disaster-recovery drill

Quarterly: restore the latest backup on a **separate** machine and verify the data. Never test restore over a live production database.
