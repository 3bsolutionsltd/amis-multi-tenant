# 11. Security Hardening

| Area | Action |
|------|--------|
| **Secrets** | Never commit or email `.env.offline`. `chmod 600 config/.env.offline`. |
| **OS users** | Run Docker as a non-root user added to the `docker` group. |
| **Firewall** | Allow only ports `:80` and `:3001` inbound from the LAN. Block all WAN inbound. Use `ufw` on Ubuntu. |
| **TLS on LAN** | Optional — issue an internal-CA cert and front the stack with your existing reverse proxy. |
| **Database port** | `5432` must **not** appear in `ss -tlnp`. Only the internal docker network sees it. |
| **Backups** | Encrypt off-site copies (e.g. `age`, VeraCrypt) before shipping to USB. |
| **OS updates** | Monthly: `apt-get update && apt-get -y upgrade && reboot`. |
| **Audit** | AMIS logs auth events. Tail with `docker compose ... logs api \| grep AUDIT`. |
| **Roles** | Apply least privilege: `admin`, `registrar`, `finance`, `hod`, `instructor`, `principal`, `dean`. |
| **Sessions** | JWT tokens are short-lived. Refresh tokens rotate on use. |
| **Passwords** | Argon2id for password hashing. Minimum 10 characters enforced at the API. |

## Recommended `ufw` rules (Ubuntu)

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow from 192.168.0.0/16 to any port 22        # SSH from LAN
ufw allow from 192.168.0.0/16 to any port 80        # Web
ufw allow from 192.168.0.0/16 to any port 3001      # API
ufw enable
ufw status verbose
```

Adjust the `192.168.0.0/16` subnet to match the institution's LAN.

## Reporting a vulnerability

Email **security@3bsolutions.co.ug**. See the repo's `SECURITY.md` for the disclosure policy.
