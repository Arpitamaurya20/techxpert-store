# Put the store API on the VPS (FileZilla + Apache)

Your other Node apps live under `/var/www/node-projects/`. This project gets its own folder there. The phone app (`app/`) stays on developer machines only — it is **not** uploaded.

Product pictures are **not** in GitHub. They live only on the VPS next to the API.

## Intent

| Goal | How |
|---|---|
| Portal + API reachable on the internet | Upload `web` + `server` builds; Apache (or nginx) fronts Node |
| Product images load in portal and apps | Copy `server/catalog/catalog/` onto the VPS; set `PUBLIC_API_ORIGIN` |
| App team keeps developing | They point Expo at `https://api.…`; they do not need the image folder |

## Layout on the VPS

```text
/var/www/node-projects/techxpert-store/
├── server/                          # API only
│   ├── dist/                        # built JS (from laptop: npm run build)
│   ├── package.json
│   ├── package-lock.json
│   ├── .env                         # secrets — create on VPS, never upload from laptop casually
│   ├── sql/                         # migration scripts
│   ├── catalog/
│   │   └── catalog/                 # THE PICTURES (large; FileZilla once)
│   │       ├── Amazon.in _ …/
│   │       ├── Fans/
│   │       └── staff/               # portal uploads later
│   └── uploads/                     # banner images (created at runtime)
└── web/
    └── dist/                        # built portal (static files)
```

Do **not** upload: `app/`, `.git/`, `node_modules/`, `server/src/` (use `dist/` instead), `server/catalog.zip` unless you prefer unzipping on the server.

DB paths look like `store/assets/catalog/<folder>/<file>`.  
Files on disk must be `server/catalog/catalog/<folder>/<file>`.

---

## Step A — Create the folder on the VPS (SSH / terminal)

```bash
sudo mkdir -p /var/www/node-projects/techxpert-store/server/catalog
sudo mkdir -p /var/www/node-projects/techxpert-store/web
sudo chown -R "$USER":"$USER" /var/www/node-projects/techxpert-store
```

In FileZilla remote pane: open `/` → `var` → `www` → `node-projects` → you should see `techxpert-store`.

---

## Step B — Build on the laptop (before upload)

```bash
cd /Users/satwik/Desktop/techxpert-store

cd server
npm ci
npm run build          # creates server/dist/

cd ../web
npm ci
VITE_API_BASE_URL=https://api.YOURDOMAIN npm run build   # creates web/dist/
```

Replace `https://api.YOURDOMAIN` with the real public API URL you will use.

---

## Step C — FileZilla: what to upload

Local left: `/Users/satwik/Desktop/techxpert-store`  
Remote right: `/var/www/node-projects/techxpert-store`

### C1 — API code (small)

Upload into remote `techxpert-store/server/`:

| From laptop | To VPS |
|---|---|
| `server/dist/` | `server/dist/` |
| `server/package.json` | `server/package.json` |
| `server/package-lock.json` | `server/package-lock.json` |
| `server/sql/` | `server/sql/` |
| `server/deploy/` | `server/deploy/` (optional samples) |

Skip `server/node_modules`, `server/src`, `server/.env` (create `.env` on the VPS).

### C2 — Portal (small)

Upload laptop `web/dist/` → remote `techxpert-store/web/dist/`.

### C3 — Product pictures (large, once)

**Option 1 — folder:**  
Laptop `server/catalog/catalog/` → remote `techxpert-store/server/catalog/catalog/`  
(so you see folders like `Amazon.in _ ceiling fans` inside `catalog/catalog`).

**Option 2 — zip (often faster):**  
Upload `server/catalog.zip` to `techxpert-store/server/`, then on SSH:

```bash
cd /var/www/node-projects/techxpert-store/server
unzip -o catalog.zip -d catalog
# Confirm:
ls catalog/catalog | head
# Must list category folders, NOT a nested extra "catalog" only by mistake
```

If unzip creates `catalog/catalog/catalog/…`, move one level up so paths match the DB.

---

## Step D — MySQL and `.env` on the VPS

Databases used: **`techxpertstore`** + **`homecare`** only (not `techxpert_commerce`).

Create `/var/www/node-projects/techxpert-store/server/.env`:

```bash
NODE_ENV=production
PORT=5001
HOST=127.0.0.1

MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=<db-user>
MYSQL_PASSWORD=<secret>

DB_USERS=homecare
DB_STORE=techxpertstore

JWT_SECRET=<24+ random characters>
CORS_ORIGINS=https://admin.YOURDOMAIN
PUBLIC_API_ORIGIN=https://api.YOURDOMAIN
```

`PUBLIC_API_ORIGIN` is what makes product `imageUrl` values full `https://…` links.

```bash
cd /var/www/node-projects/techxpert-store/server
npm ci --omit=dev
# If this DB is older than develop, run missing scripts from sql/README.md
```

---

## Step E — Run the API

Copy `server/deploy/techxpert-api.service`, edit paths to:

`WorkingDirectory=/var/www/node-projects/techxpert-store/server`

```bash
sudo cp /var/www/node-projects/techxpert-store/server/deploy/techxpert-api.service /etc/systemd/system/
# edit User= to a user that owns the files, if not "techxpert"
sudo systemctl daemon-reload
sudo systemctl enable --now techxpert-api
curl -s http://127.0.0.1:5001/health
```

---

## Step F — Apache (or your existing reverse proxy)

Point `api.YOURDOMAIN` at `http://127.0.0.1:5001` (sample in `server/deploy/apache-api.conf`).  
That must include `/store/assets/catalog/…` — a full `ProxyPass /` covers it.

Point `admin.YOURDOMAIN` at `/var/www/node-projects/techxpert-store/web/dist`.

---

## Step G — Prove images

1. `curl -s https://api.YOURDOMAIN/catalog/products/3` → `imageUrl` starts with `https://api.YOURDOMAIN/store/assets/catalog/`
2. Open that URL in a browser → picture loads
3. Portal Products list shows thumbnails

---

## Later updates

| Change | Action |
|---|---|
| New code | Rebuild locally; re-upload `server/dist` + `web/dist`; `systemctl restart techxpert-api` |
| New SQL | Run file from `server/sql/` on MySQL |
| New pictures | Sync only `server/catalog/catalog/` |
| Staff portal uploads | Already written under `catalog/catalog/staff/` on the VPS — back that up |

## Do not

- Upload `app/` to the VPS  
- Commit or upload `catalog/catalog` into GitHub  
- Point `DB_STORE` at `techxpert_commerce`  
- Overwrite `.env` or wipe `catalog/catalog` on a code-only deploy  
