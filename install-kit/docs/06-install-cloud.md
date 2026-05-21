# 6. Cloud / VPS Installation

Use this mode **only** if the institution has reliable internet at the server site and prefers remote hosting. Otherwise stay with [05 — Offline install](05-install-offline.md).

## Prerequisites

- VPS running Ubuntu 22.04 LTS with SSH key access.
- DNS A records pointing to the VPS:
  - `amis.<your-domain>` (frontend)
  - `api.amis.<your-domain>` (API)
- Firewall: ports `80` and `443` open inbound.

## Install

```bash
ssh root@<VPS-IP>

apt-get update
apt-get install -y docker.io docker-compose-plugin certbot python3-certbot-nginx nginx git

mkdir -p /opt/amis && cd /opt/amis
git clone https://github.com/3bsolutionsltd/amis-multi-tenant.git .

cp .env.prod.example .env
nano .env       # fill POSTGRES_PASSWORD, JWT_SECRET, CORS_ORIGIN, VITE_API_URL

docker compose -f docker-compose.prod.yml up -d --build
```

## Nginx + TLS

```bash
cp nginx/amis.conf /etc/nginx/sites-available/amis.conf
ln -s /etc/nginx/sites-available/amis.conf /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d amis.<domain> -d api.amis.<domain>
```

Cloud-mode bind addresses:
- API → `127.0.0.1:3001`  (proxied by Nginx)
- Web → `127.0.0.1:8095`  (proxied by Nginx)
- DB  → internal docker network only

For staging, transactional email (Resend), and detailed Nginx config, see the repo's `DEPLOY.md`.
