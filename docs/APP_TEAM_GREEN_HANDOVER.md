# App team + platform handover — green unified commerce

**Date:** 24 Nov 2026  
**Docs branch:** `docs/store-customer-api` (this file + related docs only)  
**Code homes:** edit / build / upload green **only** from `Desktop/BLUE_GREEN/`  
**Green Store API:** `https://apitest.jiotechxpert.com`  
**Green Homecare API:** `https://apitest.techxpertindia.com`  
**Blue Store (prod — do not treat as green):** `https://store.jiotechxpert.com`

This document is the shared contract: **what platform already did**, **what app must deliver**, and **how to unblock the login 503** the app team reported.

**After every docs pull:** use [`APP_TEAM_PULL_BRIEF.md`](./APP_TEAM_PULL_BRIEF.md) for the pasteable brief and end-to-end verification checkmarks (auth, COD, PayU).

---

## 0. Login 503 — diagnosis and fix (ops, not app code)

Verified 24 Nov 2026 against live hosts:

| Call | Host | Result | Meaning |
|---|---|---|---|
| `POST /auth/login` | apitest | **403** | Expected when `NODE_ENV=production`. Dev-only shortcut. **Apps must not call this.** |
| `POST /auth/send-otp` | apitest **and** blue store | **503** `"The sign-in code could not be sent. Ask for a new one."` | Store OTP SMS transport missing or PRP rejected the send |
| `GET /health` | apitest | **200**, both DBs ok | API + MySQL are fine — this is **not** a DB outage |
| Homecare `POST /api/auth/send-otp` | api / apitest Homecare | **404** user-not-found for dummy phone | Homecare SMS path is reachable (different product rules) |

**Real customer login path (Store Expo):**

```text
POST /auth/send-otp  →  POST /auth/verify-otp  →  Authorization: Bearer <token>
```

**Fix on each Store Node host** (blue and/or green) — edit **existing** `server/.env`, then restart PM2. Do **not** overwrite `.env` from laptop.

```bash
# Required for production OTP (same PRP credentials Homecare already uses for TECHXPERT OTP)
OTP_SMS_PROVIDER=prp
PRP_SMS_API_KEY=<same key as Homecare backend>
PRP_SMS_SENDER=TECHX
PRP_SMS_TEMPLATE_NAME=TECHXPERT OTP

# Confirm NODE_ENV=production on VPS (keeps /auth/login refused — correct)
# Do NOT set OTP_SMS_PROVIDER=console on production (code treats that as missing)
```

```bash
pm2 restart store-api-green   # or blue store process name
curl -sS -X POST https://apitest.jiotechxpert.com/auth/send-otp \
  -H 'Content-Type: application/json' \
  -d '{"phone":"<real 10-digit test phone>"}'
# Expect HTTP 200 when PRP accepts; then verify-otp with the SMS code
```

**App team:** if you still see 503 after ops confirms the curl above returns 200, paste request URL + body (no secrets). Until then, treat 503 as **server SMS config**, not Expo bug.

Local laptop: leave `NODE_ENV` unset; code uses fixed OTP `123456` and `send-otp` may return `devOtp` — no SMS needed.

---

## 1. Platform work and intent (what we already did)

### Intent

- One shared identity: `homecare.users.user_id` for Homecare bookings **and** Store materials.
- **Separate checkouts** (no Mode C / combo cart): Homecare money path stays on Homecare; Store COD|PayU stays on Store.
- Green isolation: all green/unified-commerce edits live under `Desktop/BLUE_GREEN/*` on branch `green/unified-commerce`. Main Desktop product folders stay the normal product line.
- Same GitHub remotes as prod — **no** separate `*-green` GitHub orgs.

### Store (BLUE_GREEN `techxpert-store-main`, branch `green/unified-commerce`)

| Area | Status |
|---|---|
| Customer OTP auth hardening + rate limits | Done in code |
| Bridge default-deny + `ALLOW_HOMECARE_EXCHANGE_TOKENS` kill switch | Done (default **off**) |
| S2S `/service/v1/*` + Apache public 403 | Done in code/config |
| Checkout idempotency SQL + header | Done |
| Store PayU API (initiate / success / failure / verify) + `payment_orders` SQL | Done (API + docs; **no Expo PayU UI**) |
| Tests | `npm test` → **314 pass**; `npm run build` → `server/dist/` |

Key commits on that line: `111c1d6` (auth/bridge/S2S/idempotency), `40d8022` (PayU + customer docs).

### Homecare (BLUE_GREEN `techxpert_backend-main`, branch `green/unified-commerce`)

| Area | Status |
|---|---|
| `POST /api/auth/store-token` (mint Store exchange JWT) | Done in code |
| `GET /api/activity` (unified Activity, ship-dark behind flag) | Done in code |
| `sql/feature_flags.sql` | Done |
| Tests | activity / storeTokens / featureFlags → **12 pass** |

### Explicitly **not** done by platform in this slice

- Expo PayU WebView / deep-link UI  
- Enabling `ALLOW_HOMECARE_EXCHANGE_TOKENS=true` on any host  
- Enabling `UNIFIED_ACTIVITY_V1` for all users  
- Mode C combo checkout  
- Merging `green/unified-commerce` into `main` / `develop`  
- Copying PRP keys into git

---

## 2. Where files go on the server (upload map)

**Laptop source of truth for green uploads:**

```text
/Users/satwik/Desktop/BLUE_GREEN/techxpert-store-main/
/Users/satwik/Desktop/BLUE_GREEN/techxpert_backend-main/
```

**Do not** FileZilla green from `Desktop/techxpert-store` or `Desktop/Homecare/backend`.

### Store → VPS `/var/www/green-node/store/`

Build first:

```bash
cd /Users/satwik/Desktop/BLUE_GREEN/techxpert-store-main/server
npm ci && npm test && npm run build
```

| Laptop | VPS |
|---|---|
| `server/dist/` (entire folder) | `store/server/dist/` |
| `server/package.json` + `package-lock.json` | `store/server/` |
| `server/sql/` (entire folder) | `store/server/sql/` |
| `server/deploy/apache-api.conf` | reference — merge `/service` deny into apitest vhost |
| `.env` | **never overwrite** — edit keys in place on VPS |

After upload: `npm ci --omit=dev`, run SQL below, `pm2 restart store-api-green`.

Green Store Node listens on **VPS port 5003** (Apache → apitest). That is unrelated to Homecare’s laptop port 5003.

### Homecare → VPS `/var/www/green-node/homecare-backend/`

| Laptop | VPS |
|---|---|
| `src/app.js` | `…/src/app.js` |
| `src/config/storeClient.js` | `…/src/config/` |
| `src/routes/storeToken.js`, `activity.js` | `…/src/routes/` |
| `src/services/storeTokens.js`, `storeApiClient.js`, `featureFlags.js`, `activity*.js` | `…/src/services/` |
| `sql/feature_flags.sql` | `…/sql/` |

Env on Homecare green (same bridge secret as Store green):

```bash
HOMECARE_STORE_BRIDGE_SECRET=<shared long secret>
STORE_API_BASE_URL=http://127.0.0.1:5003
```

Full checklist: [`GREEN_DEPLOY_MANIFEST.md`](./GREEN_DEPLOY_MANIFEST.md).

---

## 3. Migrations / SQL to run on the server

Run against **green** schemas only (`techxpertstore_green` / `homecare_green`). Never point these at blue prod DBs for experiments.

### Store DB (`techxpertstore_green`) — this slice

```bash
cd /var/www/green-node/store/server
mysql -u green_app -p techxpertstore_green < sql/checkout_idempotency.sql
mysql -u green_app -p techxpertstore_green < sql/payment_orders.sql
```

Both are safe to re-run. Older green hosts that never got portal/shop scripts still need the baseline list in `server/sql/README.md` before this slice — ask ops if tables like `orders` / `portal_staff` are missing.

### Homecare DB (`homecare_green`) — this slice

```bash
cd /var/www/green-node/homecare-backend
mysql -u green_app -p homecare_green < sql/feature_flags.sql
```

Activity stays **off** until you explicitly:

```sql
UPDATE feature_flags SET enabled = 1 WHERE flag_key = 'UNIFIED_ACTIVITY_V1';
```

### Not a SQL migration — but required for login

OTP SMS env on Store (section 0). Without it, every production `send-otp` is 503.

---

## 4. App team — work, intent, and expected delivery

### Intent for the Store Expo app

Ship a coherent **materials shopping** experience against **green** first (`apitest.jiotechxpert.com`), using **Store OTP JWT**, without depending on Homecare exchange tokens yet.

### Must implement / verify

| # | Deliverable | Done when |
|---|---|---|
| A1 | Base URL → green Store (`https://apitest.jiotechxpert.com` or `/api` twin) | Config documented; no hard-coded blue unless toggle |
| A2 | Login = `send-otp` → `verify-otp` only | Never call `POST /auth/login` on green/prod |
| A3 | Persist Store JWT; hydrate session; clear on 401 | Matches existing `app/` session patterns |
| A4 | Protected calls: `/auth/me`, addresses, cart, checkout, orders | Bearer on customer routes |
| A5 | COD checkout | `POST /cart/checkout` with `paymentMethod: "COD"` + optional `Idempotency-Key` |
| A6 | Catalog/browse against live green | Categories / products / home-boot usable |

### Should implement next (API ready; UI still app-owned)

| # | Deliverable | Done when |
|---|---|---|
| B1 | PayU UI | After COD checkout with `paymentMethod: "PayU"`, call `POST /payments/payu/initiate`, open PayU, then `POST /payments/payu/verify`; show paid/failed from `GET /orders/:id` |
| B2 | Deep link / return URL | Align with `APP_PAYU_RETURN_URL` once ops sets it |

### Out of scope for Store Expo in this slice

| Item | Owner |
|---|---|
| Homecare `POST /api/auth/store-token` + exchange Bearer | Homecare app (Mode B later) |
| Homecare `GET /api/activity` UI | Homecare app (after flag on) |
| Combo / Mode C cart | Neither — deferred |
| Fixing Store 503 by changing Expo | Ops SMS env (section 0) |

### Contract docs to implement against

1. [`STORE_CUSTOMER_API.md`](./STORE_CUSTOMER_API.md) — route + auth bible  
2. [`APP_API_GUIDE.md`](./APP_API_GUIDE.md) — request/response examples (incl. UC-10b PayU)  
3. [`GREEN_DEPLOY_MANIFEST.md`](./GREEN_DEPLOY_MANIFEST.md) — when green is live enough to point the app  
4. This file — 503 + deliverables  

### Smoke the app team can run (after ops SMS fix)

```bash
# 1) OTP
curl -sS -X POST https://apitest.jiotechxpert.com/auth/send-otp \
  -H 'Content-Type: application/json' -d '{"phone":"<test>"}'
# 2) verify-otp with SMS code → save token
# 3) curl -H "Authorization: Bearer <token>" https://apitest.jiotechxpert.com/auth/me
# 4) cart → checkout COD → GET /orders
```

---

## 5. Homecare app team (companion — not Store Expo)

| When | Work |
|---|---|
| After Store green + shared `HOMECARE_STORE_BRIDGE_SECRET` + `ALLOW_HOMECARE_EXCHANGE_TOKENS=true` | Call `POST /api/auth/store-token` with Homecare customer JWT; keep Store exchange token **in memory**; use on Store catalog/cart/checkout only |
| After `UNIFIED_ACTIVITY_V1` enabled for cohort | Consume `GET /api/activity` (ship-dark until then returns flag-off) |
| Always | Keep Homecare booking/PayU on Homecare hosts — do not send booking checkout to Store |

---

## 6. Git / docs shipping

| Branch | Contents | Push |
|---|---|---|
| `docs/store-customer-api` | Docs only for app + ops (this handover pack) | Yes — so app team can start |
| `green/unified-commerce` | Server + Homecare green code | Separate; after green smoke / when human asks |
| `feature/store-auth-protect` | Historical Store code line | Backup; do not treat as FileZilla source |

**Rule:** future green code edits only under `Desktop/BLUE_GREEN/`. See repo root `BLUE_GREEN/README.md` and [`WORKSPACE_DEPLOY_CLARITY.md`](./WORKSPACE_DEPLOY_CLARITY.md).
