# 5. Offline / On-Premises Installation

> **Before you begin** — confirm that all hardware, OS, and software requirements in [§3 — Requirements](03-requirements.md) have been met, and that the [§4 — Pre-install checklist](04-pre-install.md) is fully ticked off. Skipping either will likely result in a failed install.

This is the **primary** install mode. It assumes no internet on the server itself.

## Fast path — one command

```bash
# Linux
cd /opt/amis/install-kit
sudo ./install.sh
```
```powershell
# Windows
Set-Location C:\amis\install-kit
.\install.ps1
```

The installer will:

1. Verify Docker is reachable.
2. `docker load` the four `images/*.tar` files.
3. Ask you for the **server LAN IP**.
4. Auto-generate `POSTGRES_PASSWORD` and `JWT_SECRET`.
5. Write `config/.env.offline` (mode 600).
6. Bring up the DB, apply all migrations, start the API and Web.
7. Run a health check and print the URL.

Skip to **[07 — First login](07-first-login.md)** when it finishes.

---

## Manual path (step-by-step)

Use this if the automatic installer fails, or if you prefer to do it by hand.

### Step 1 — Copy the kit to the server

```bash
# Linux
sudo mkdir -p /opt/amis && sudo chown $USER:$USER /opt/amis
cp -r /media/usb/install-kit /opt/amis/
cd /opt/amis/install-kit
```
```powershell
# Windows
New-Item -ItemType Directory -Force -Path C:\amis | Out-Null
Copy-Item -Recurse E:\install-kit C:\amis\
Set-Location C:\amis\install-kit
```

### Step 2 — Load Docker images

```bash
./scripts/load-images.sh        # Linux
```
```powershell
.\scripts\load-images.ps1       # Windows
```

Verify:

```bash
docker images | grep -E 'amis|postgres'
```

### Step 3 — Create the env file

```bash
cp config/.env.offline.example config/.env.offline
nano config/.env.offline
chmod 600 config/.env.offline
```

Fill in **every** value:

| Variable | What to set | Generate with |
|----------|-------------|----------------|
| `POSTGRES_PASSWORD` | Strong random string (no `$`) | `openssl rand -base64 24` |
| `JWT_SECRET` | 64 random hex bytes | `openssl rand -hex 64` |
| `CORS_ORIGIN` | `http://<server-LAN-IP>` (no trailing `/`) | — |
| `VITE_API_URL` | `http://<server-LAN-IP>:3001` | — |

> ⚠️ `VITE_API_URL` is **baked into the web image**. If the server IP changes later, request a rebuilt image bundle from 3B Solutions or use a LAN DNS name.

### Step 4 — Database + migrations

```bash
docker compose -f config/docker-compose.offline.yml --env-file config/.env.offline up -d db
sleep 8
docker compose -f config/docker-compose.offline.yml --env-file config/.env.offline run --rm migrate
```

### Step 5 — Start the rest of the stack

```bash
docker compose -f config/docker-compose.offline.yml --env-file config/.env.offline up -d
docker compose -f config/docker-compose.offline.yml --env-file config/.env.offline ps
```

Expected:

```
NAME              STATUS
amis-db-1         Up (healthy)
amis-api-1        Up (healthy)
amis-web-1        Up
amis-migrate-1    Exited (0)
```

### Step 6 — Smoke test

```bash
curl http://localhost:3001/health        # {"status":"ok"}
curl -I http://localhost                 # HTTP/1.1 200
```

From a laptop on the LAN, browse to `http://<server-LAN-IP>`. The AMIS login page must load.

### Step 7 — Auto-start on boot

```bash
sudo systemctl enable docker             # Linux
```
Windows: ensure the Docker service is set to **Automatic** start.

The AMIS containers use `restart: always` so they come back automatically with Docker.

Continue to **[06 — Cloud install](06-install-cloud.md)** *(optional)* or jump to **[07 — First login](07-first-login.md)**.
