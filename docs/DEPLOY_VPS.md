# Put the store API on a Linux VPS (FileZilla + Apache)

No CI pipeline. You upload files, then run a few commands on the server. Product pictures stay on the VPS; they are not in GitHub.

## What lives where

| On the VPS | Purpose |
|---|---|
| `/var/www/techxpert-store/server/` | API code (`dist/`, `package.json`, `.env`) |
| `/var/www/techxpert-store/server/catalog/catalog/` | Product pictures (from the old VPS / your laptop) |
| `/var/www/techxpert-store/server/uploads/` | Banner uploads from the portal |
| `/var/www/techxpert-store/web/dist/` | Built portal (static files) |
| MySQL | `techxpertstore` + `homecare` only |

GitHub holds code and `server/sql/`. It never holds `catalog/catalog/`.

## 1. One-time on the VPS

```bash
sudo apt update
sudo apt install -y nginx   # or apache2 — examples below use Apache
# Node 20+:
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo apt install -y mysql-server apache2
sudo a2enmod proxy proxy_http headers ssl rewrite
```

Create a user and folders:

```bash
sudo useradd -r -m -d /var/www/techxpert-store -s /bin/bash techxpert || true
sudo mkdir -p /var/www/techxpert-store/server/catalog
sudo mkdir -p /var/www/techxpert-store/web
sudo chown -R techxpert:techxpert /var/www/techxpert-store
```

## 2. Upload with FileZilla

Connect as a user that can write `/var/www/techxpert-store`.

**Code (from your laptop after `git pull` on develop):**

1. On the laptop, in `server/`: `npm ci && npm run build`
2. On the laptop, in `web/`: `VITE_API_BASE_URL=https://api.YOURDOMAIN npm ci && npm run build`
3. Upload `server/package.json`, `server/package-lock.json`, `server/dist/`, `server/sql/` into `/var/www/techxpert-store/server/`
4. Upload `web/dist/` into `/var/www/techxpert-store/web/dist/`

**Pictures (once, then only when the library changes):**

1. Upload the whole `catalog/catalog` folder to `/var/www/techxpert-store/server/catalog/catalog/`
2. Or upload `catalog.zip` and on the VPS:

```bash
cd /var/www/techxpert-store/server
unzip -o catalog.zip -d catalog
# Result must be: server/catalog/catalog/<folder>/<file>
# matching DB paths store/assets/catalog/<folder>/<file>
ls catalog/catalog | head
```

Do **not** overwrite `server/.env` or `server/catalog/catalog/` on later code-only uploads.

## 3. API settings on the VPS

Create `/var/www/techxpert-store/server/.env` (never commit it):

```bash
NODE_ENV=production
PORT=5001
HOST=127.0.0.1

MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=techxpert
MYSQL_PASSWORD=<secret>

DB_USERS=homecare
DB_STORE=techxpertstore

JWT_SECRET=<24+ random characters>
CORS_ORIGINS=https://admin.YOURDOMAIN
PUBLIC_API_ORIGIN=https://api.YOURDOMAIN
```

`PUBLIC_API_ORIGIN` is required in production so product and banner pictures become full `https://` addresses.

On the VPS:

```bash
cd /var/www/techxpert-store/server
sudo -u techxpert npm ci --omit=dev
# SQL for any scripts they do not have yet — see server/sql/README.md and docs/ROLLOUT.md
```

## 4. Keep the API running

`/etc/systemd/system/techxpert-api.service`:

```ini
[Unit]
Description=Techxpert Store API
After=network.target mysql.service

[Service]
Type=simple
User=techxpert
Group=techxpert
WorkingDirectory=/var/www/techxpert-store/server
EnvironmentFile=/var/www/techxpert-store/server/.env
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now techxpert-api
sudo systemctl status techxpert-api
curl -s http://127.0.0.1:5001/health
```

## 5. Apache in front (HTTPS → Node)

API vhost (`/etc/apache2/sites-available/techxpert-api.conf`):

```apache
<VirtualHost *:80>
    ServerName api.YOURDOMAIN
    Redirect permanent / https://api.YOURDOMAIN/
</VirtualHost>

<VirtualHost *:443>
    ServerName api.YOURDOMAIN
    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/api.YOURDOMAIN/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/api.YOURDOMAIN/privkey.pem

    ProxyPreserveHost On
    RequestHeader set X-Forwarded-Proto "https"
    # Proxies /api, /catalog, /store/assets/catalog, /uploads, /health, …
    ProxyPass / http://127.0.0.1:5001/
    ProxyPassReverse / http://127.0.0.1:5001/
</VirtualHost>
```

Portal vhost serves `/var/www/techxpert-store/web/dist` as `admin.YOURDOMAIN`.

```bash
sudo a2ensite techxpert-api
sudo systemctl reload apache2
```

TLS: `sudo certbot --apache -d api.YOURDOMAIN -d admin.YOURDOMAIN`

## 6. Checks

- [ ] `GET https://api.YOURDOMAIN/health` → both DBs `ok`
- [ ] `GET https://api.YOURDOMAIN/catalog/products/3` → `imageUrl` starts with `https://api.YOURDOMAIN/store/assets/catalog/`
- [ ] Open that `imageUrl` in a browser → JPEG/WebP, not 404
- [ ] Portal Products list shows thumbnails
- [ ] Upload a cover in Edit product → file appears under `server/catalog/catalog/staff/<id>/`

## 7. Later updates

| Change | What to upload |
|---|---|
| New API/portal code | Rebuild locally, upload `server/dist` + `web/dist`, `systemctl restart techxpert-api` |
| New SQL feature | Run the new file from `server/sql/` on MySQL |
| New / replaced catalogue pictures | Sync only `server/catalog/catalog/` (rsync or FileZilla) |
| Staff uploads | Already on the VPS; include `catalog/catalog/staff/` in backups |

## Rollback

Keep the previous `server/dist` and `web/dist` folders renamed (`dist.bak`). Point them back and restart the service. Picture files are independent of the Node build.
