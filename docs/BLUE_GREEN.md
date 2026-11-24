# Blue / green — test hosts and deploy

**Status:** ops runbook for the parallel green stack. Blue (prod) is never overwritten by these steps.  
**Code line:** branch `green/unified-commerce` in each product repo (same GitHub remotes as prod; no separate `*-green` remotes).  
**Local workspace:** `/Users/satwik/Desktop/BLUE_GREEN/` (`techxpert-store-main`, `techxpert_backend-main`, `techxpert_frontend-main`).

Related: [DEPLOY_VPS.md](./DEPLOY_VPS.md) (blue Store), unified commerce [design](./superpowers/specs/2026-11-20-unified-commerce-design.md) / [Phase 0–1 plan](./superpowers/plans/2026-11-20-unified-commerce-phase-0-1.md).

---

## 1. Host map

| Role | Green URL | Blue (do not change in this runbook) |
|---|---|---|
| Store API | `https://apitest.jiotechxpert.com` | `https://store.jiotechxpert.com` |
| Store portal UI | `https://uitest.jiotechxpert.com` | (often same host as Store API today) |
| Homecare API | `https://apitest.techxpertindia.com` | Homecare prod API |
| Homecare UI | `https://uitest.techxpertindia.com` | Homecare prod UI |

```text
Laptop (green/unified-commerce)
  → build
  → FileZilla / rsync to VPS green folders
  → Apache TLS vhosts → green Node ports / static dist
```

---

## 2. VPS layout (parallel to blue)

Blue apps stay under `/var/www/node-projects/` (e.g. `store`, `homeservice-backend`, `homeservice-frontend`).  
**Green root (locked):** `/var/www/green-node/` — create everything green here so nothing overlaps blue.

```text
/var/www/green-node/
  store/                        # GREEN Store
    server/                     # dist/, package*.json, sql/, .env, catalog/ (symlink or copy)
    web/dist/                   # portal build
  homecare-backend/             # GREEN Homecare API
  homecare-frontend/            # GREEN Homecare UI static dist
```

**Suggested Node ports (localhost only):**

| Process | Port | Process name |
|---|---|---|
| Store green API | `5003` | `techxpert-api-green` (systemd) |
| Homecare green API | `5004` | `homecare-api-green` (pm2 or systemd) |

Blue keeps `5001` / Homecare’s existing port. Green must **not** bind the blue ports. (If `5003` is busy on a host, pick the next free port and keep Apache in sync.)

---

## 3. DNS and TLS (once)

1. A/AAAA for all four names → VPS public IP.  
2. `certbot` (or existing LE flow) for:
   - `apitest.jiotechxpert.com`
   - `uitest.jiotechxpert.com`
   - `apitest.techxpertindia.com`
   - `uitest.techxpertindia.com`  
3. Confirm `dig` / browser TLS before uploading code.

---

## 4. MySQL green schemas + dedicated login (mandatory isolation)

Same MySQL instance as blue is fine. You need:

1. Two **new databases** that are full copies of blue.  
2. A **new MySQL user** that can only read/write those two databases (not blue).

### 4.1 Dump blue (SSH as root; use your phpMyAdmin/root MySQL password)

```bash
mkdir -p /root/green-db-backups
mysqldump -u root -p --single-transaction --routines --triggers \
  homecare > /root/green-db-backups/homecare_$(date +%Y%m%d).sql
mysqldump -u root -p --single-transaction --routines --triggers \
  techxpertstore > /root/green-db-backups/techxpertstore_$(date +%Y%m%d).sql
ls -lh /root/green-db-backups/
```

`techxpertstore` dump can be large (tens–hundreds of MB); wait for it to finish.

### 4.2 Create green databases and import

```bash
mysql -u root -p <<'SQL'
CREATE DATABASE IF NOT EXISTS homecare_green CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS techxpertstore_green CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
SQL

mysql -u root -p homecare_green < /root/green-db-backups/homecare_$(date +%Y%m%d).sql
mysql -u root -p techxpertstore_green < /root/green-db-backups/techxpertstore_$(date +%Y%m%d).sql
```

(Or pick the exact dump filenames from `ls`.)

### 4.3 Dedicated green MySQL user (different from blue)

Pick a strong password; store it only in green `.env` files on the VPS.

```bash
mysql -u root -p <<'SQL'
CREATE USER IF NOT EXISTS 'green_app'@'localhost' IDENTIFIED BY 'REPLACE_WITH_STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON homecare_green.* TO 'green_app'@'localhost';
GRANT ALL PRIVILEGES ON techxpertstore_green.* TO 'green_app'@'localhost';
-- Store green joins identity across schemas on one connection — allow both
FLUSH PRIVILEGES;
SHOW GRANTS FOR 'green_app'@'localhost';
SQL
```

**Do not** `GRANT` this user on `homecare.*` or `techxpertstore.*` (blue).

Verify isolation:

```bash
mysql -u green_app -p -e "SHOW DATABASES;"
# Expect: homecare_green, techxpertstore_green (plus information_schema etc.) — not blue app DBs writable
mysql -u green_app -p techxpertstore_green -e "SELECT COUNT(*) AS products FROM products;"
mysql -u green_app -p homecare_green -e "SELECT COUNT(*) AS users FROM users;"
```

### 4.4 Point green apps at these DBs

| App | Env keys |
|---|---|
| Store green | `MYSQL_USER=green_app`, `MYSQL_PASSWORD=…`, `DB_USERS=homecare_green`, `DB_STORE=techxpertstore_green` |
| Homecare green | `DB_USER=green_app`, `DB_PASSWORD=…`, `DB_NAME=homecare_green` |

**Never** set green `.env` to blue schema names (`homecare` / `techxpertstore`) while developing unified commerce.

phpMyAdmin: you can log in as `green_app` to browse only the green DBs, or keep using root and switch database — root is for ops; apps use `green_app` only.

---

## 5. Build on the laptop (from `green/unified-commerce`)

```bash
# Store API
cd /Users/satwik/Desktop/BLUE_GREEN/techxpert-store-main/server
npm ci
npm run build          # → server/dist/

# Store portal — API URL must be green Store API (same line as build)
cd ../web
npm ci
VITE_API_BASE_URL=https://apitest.jiotechxpert.com npm run build   # → web/dist/

# Homecare API — no compile step; upload source (or follow their usual PM2 path)
cd /Users/satwik/Desktop/BLUE_GREEN/techxpert_backend-main
npm ci --omit=dev

# Homecare UI
cd /Users/satwik/Desktop/BLUE_GREEN/techxpert_frontend-main
npm ci
# Point at green Homecare API (same-line / .env.production for build)
VITE_AUTH_API_URL=https://apitest.techxpertindia.com/api \
VITE_API_URL=https://apitest.techxpertindia.com \
  npm run build
```

Do **not** upload `app/`, `.git`, local `.env`, or `node_modules` from the laptop when FileZilla can install on the server (`npm ci --omit=dev` on VPS).

---

## 6. Upload checklist

### Store green

| Laptop | VPS |
|---|---|
| `server/dist/` | `/var/www/green-node/store/server/dist/` |
| `server/package.json` + lock | `/var/www/green-node/store/server/` |
| `server/sql/` | `/var/www/green-node/store/server/sql/` |
| `server/deploy/` | `/var/www/green-node/store/server/deploy/` (optional) |
| `web/dist/` | `/var/www/green-node/store/web/dist/` |

**Catalog pictures:** prefer symlink from blue Store catalog (path may be `node-projects/store/…` on this VPS):

```bash
mkdir -p /var/www/green-node/store/server/catalog
# Adjust blue path if your live catalog lives elsewhere:
ln -sfn /var/www/node-projects/store/server/catalog/catalog \
        /var/www/green-node/store/server/catalog/catalog
```

Do not write staff uploads into blue from green unless intentional.

### Homecare green

Upload API tree (without `node_modules` / `.env`) to `/var/www/green-node/homecare-backend/`; run `npm ci --omit=dev` on VPS.  
Upload frontend `dist/` to `/var/www/green-node/homecare-frontend/`.

---

## 7. `.env` on VPS (create on server — never upload laptop secrets blindly)

### Store green `server/.env`

```bash
NODE_ENV=production
PORT=5003
HOST=127.0.0.1

MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=<green-or-shared-user>
MYSQL_PASSWORD=<secret>

DB_USERS=homecare_green
DB_STORE=techxpertstore_green

JWT_SECRET=<new random — not blue’s>
PUBLIC_API_ORIGIN=https://apitest.jiotechxpert.com
CORS_ORIGINS=https://uitest.jiotechxpert.com,https://uitest.techxpertindia.com
# Add Capacitor origins later when Task 0 records them

ALLOW_DEV_ADMIN=0
# ALLOW_HOMECARE_EXCHANGE_TOKENS=false   # when Phase 1 lands
```

### Homecare green `.env`

```bash
NODE_ENV=production
PORT=5004
# DB_* → homecare_green
# JWT secrets: new, not blue’s
# CORS_ORIGINS include https://uitest.techxpertindia.com
# SMS: console or sandbox — not live customer SMS if avoidable
# STORE_API_BASE_URL=http://127.0.0.1:5003   # for later S2S Activity only
```

---

## 8. Process managers

**Store green (systemd):** copy `server/deploy/techxpert-api.service` → `techxpert-api-green.service`, set `WorkingDirectory=…/techxpert-store-green/server`, `Environment=PORT=5003` / `ExecStart` → `node dist/index.js`, then `daemon-reload` + `enable --now`.

**Homecare green (PM2 typical):** e.g. `pm2 start src/app.js --name homecare-api-green` from the green folder with green `.env`, or a dedicated ecosystem file that does **not** restart the blue app.

Prove locally on VPS:

```bash
curl -sS http://127.0.0.1:5003/health
curl -sS http://127.0.0.1:5004/health
```

---

## 9. Apache (four vhosts)

| ServerName | Backend |
|---|---|
| `apitest.jiotechxpert.com` | `ProxyPass / http://127.0.0.1:5003/` (+ SSL) |
| `uitest.jiotechxpert.com` | `DocumentRoot` → `…/techxpert-store-green/web/dist` |
| `apitest.techxpertindia.com` | `ProxyPass / http://127.0.0.1:5004/` (+ SSL) |
| `uitest.techxpertindia.com` | `DocumentRoot` → Homecare frontend green `dist` |

When Phase 0 S2S is deployed on green Store, add public **403** for `^/(api/)?service(/|$)` on **apitest.jiotechxpert.com** only (sample in `server/deploy/apache-api.conf`); Homecare green keeps calling `http://127.0.0.1:5003`. Set `HOMECARE_STORE_BRIDGE_SECRET` in green Store `.env` (same value Homecare green will use).

`a2ensite`, `apachectl configtest`, `systemctl reload apache2`.

---

## 10. Smoke tests (must pass before any feature work)

```bash
curl -sS https://apitest.jiotechxpert.com/health
curl -sS https://apitest.techxpertindia.com/health
curl -sS -o /dev/null -w '%{http_code}\n' https://uitest.jiotechxpert.com/
curl -sS -o /dev/null -w '%{http_code}\n' https://uitest.techxpertindia.com/
```

Optional: Store portal login against green; Homecare UI login against green; one COD checkout on green Store with `channel=homecare_app` (G4 prep) using **green** DB only.

### Feature flags (green only until cutover)

Unified Activity is **off by default**. After Homecare green has `sql/feature_flags.sql` applied to **`homecare_green`**:

```sql
-- phpMyAdmin or: mysql -u green_app -p homecare_green
UPDATE feature_flags SET enabled = 1 WHERE flag_key = 'UNIFIED_ACTIVITY_V1';
```

Full flag table + cohort examples: [`contracts/unified-commerce-phase-0-1.md`](./contracts/unified-commerce-phase-0-1.md) §9. Never run that `UPDATE` against blue `homecare` until launch.

Confirm blue still healthy:

```bash
curl -sS https://store.jiotechxpert.com/health
```

---

## 11. Cutover (later — not this deploy)

1. Prove unified-commerce exit criteria on green hosts.  
2. Merge `green/unified-commerce` → `develop`/`main` in each repo.  
3. Apply the same SQL to **blue** schemas in a window.  
4. Deploy merged build to **blue** folders / restart blue processes.  
5. Keep green hosts as the next staging lane.

---

## 12. Do not

- Deploy green builds into blue paths (`techxpert-store/` prod tree).  
- Point green `.env` at blue DB names while iterating.  
- Push `green/unified-commerce` into `main` until exit criteria pass.  
- Turn on live PayU / live SMS on green without an explicit decision.  
- Start unified-commerce Task 2+ until this smoke list is green.
