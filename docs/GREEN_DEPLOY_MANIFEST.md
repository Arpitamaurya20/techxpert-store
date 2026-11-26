# Green deploy manifest — unified commerce + Store auth (go-live pack)

**What this ships:** Store customer auth hardened + Homecare↔Store bridge + **Store PayU** (initiate/success/failure/verify) + SQL.  
**What this does not ship:** Expo PayU UI (app team); Combo / Mode C; Ionic Activity UI.

**Same login, separate checkouts:** one `homecare.users.user_id`; Homecare booking PayU stays on Homecare; Store materials COD/PayU on this API.

API route list for apps: [`STORE_CUSTOMER_API.md`](./STORE_CUSTOMER_API.md).  
Host map (green vs blue): [`APP_TEAM_PULL_BRIEF.md`](./APP_TEAM_PULL_BRIEF.md).

---

## GATE — do not tell the app team green is ready until every box passes

Uploading `dist/` + SQL is **not** enough. Store green is a **separate Node process** from Homecare green. Homecare `.env` SMS/PayU keys do **not** apply to Store.

### 1) Store green `.env` must include (edit in place — never overwrite blindly)

```bash
# --- Identity / DB (already expected) ---
PORT=5003
HOST=127.0.0.1
DB_USERS=homecare_green
DB_STORE=techxpertstore_green
PUBLIC_API_ORIGIN=https://apitest.jiotechxpert.com
JWT_SECRET=<strong local-to-green secret, min 24>

# --- CORS (Expo web + uitest). Include every Origin the app actually uses. ---
CORS_ORIGINS=https://uitest.jiotechxpert.com,https://uitest.techxpertindia.com,http://localhost:8081,http://localhost:8100

# --- OTP SMS (REQUIRED or send-otp → 503). Same TECHXPERT OTP creds as Homecare green. ---
OTP_SMS_PROVIDER=prp
PRP_SMS_API_KEY=<same as Homecare green>
PRP_SMS_SENDER=TECHX
PRP_SMS_TEMPLATE_NAME=TECHXPERT OTP

# --- Store PayU (REQUIRED for Pay online). Store test merchant — NOT Homecare PayU keys. ---
PAYU_MERCHANT_KEY=<store-test-key>
PAYU_MERCHANT_SALT=<store-test-salt>
PAYU_BASE_URL=https://test.payu.in/_payment
PAYU_SUCCESS_URL=https://apitest.jiotechxpert.com/payments/payu/success
PAYU_FAILURE_URL=https://apitest.jiotechxpert.com/payments/payu/failure
# APP_PAYU_RETURN_URL=techxpertstore://payu-return

# --- Bridge (optional until Homecare exchange on) ---
HOMECARE_STORE_BRIDGE_SECRET=<shared with Homecare green, min 24>
ALLOW_HOMECARE_EXCHANGE_TOKENS=false
```

Then: `pm2 restart store-api-green --update-env && pm2 save`

### 2) Code / CORS allowlist (ship in `dist/`)

`server/src/config/security.ts` must allow preflight headers used by checkout, including **`Idempotency-Key`**. If that header is missing from `Access-Control-Allow-Headers`, Expo web on `localhost:8081` shows a **CORS** error on `POST /cart/checkout` even when `CORS_ORIGINS` already lists localhost.

### 3) Prove before notifying app team

```bash
# Health + green DBs
curl -sS https://apitest.jiotechxpert.com/health
# Expect status ok, homecare_green + techxpertstore_green

# OTP (must be 200 — not 503)
curl -sS -w "\nHTTP:%{http_code}\n" -X POST https://apitest.jiotechxpert.com/auth/send-otp \
  -H 'Content-Type: application/json' -d '{"phone":"<real test phone>"}'

# CORS preflight for Expo web checkout (must list Idempotency-Key)
curl -sS -D - -o /dev/null -X OPTIONS \
  'https://apitest.jiotechxpert.com/api/cart/checkout' \
  -H 'Origin: http://localhost:8081' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: authorization,content-type,idempotency-key' \
  | grep -i allow-headers
# Expect: ... Idempotency-Key ...

# PayU configured (expect not “Online payment is not configured” once signed-in order exists)
# Initiate without auth → 401 is fine; 503 “not configured” means PAYU_* still missing
```

| Gate | Fail symptom if skipped |
|---|---|
| Store `OTP_SMS_*` / `PRP_*` | `send-otp` **503** (health still 200) |
| Store `PAYU_*` | Pay online / initiate **503** “Online payment is not configured” |
| `CORS_ORIGINS` includes app Origin | Browser CORS on all cross-origin calls |
| `Idempotency-Key` in CORS allowlist (`dist`) | Browser CORS on checkout/merge only |
| SQL `checkout_idempotency` + `payment_orders` | Checkout/PayU hard errors |
| `drop_cart_user_fk.sql` on schema | Cart merge / signed-in cart create **500** (`fk_cart_user` / `ER_NO_REFERENCED_ROW_2`) |

`POST /auth/login` **403** on green/prod is **correct** — apps use send-otp → verify-otp.

### Cart FK ops note (chaos F) — 2026-11-25

`carts` / `orders` / `saved_items`.`UserID` must **not** FK to local Store `users` (identity is Homecare `users.user_id`). Script: `server/sql/drop_cart_user_fk.sql`.

| Schema | Status |
|---|---|
| Local `techxpertstore` (blue) | **Clean** — 0 UserID→`users` FKs (verified 2026-11-25) |
| Local `techxpertstore_green` | N/A on laptop (schema not present locally) |
| VPS green `techxpertstore_green` | **Fixed 2026-11-26** — dropped `orders.fk_order_user` (was causing PayU/COD checkout 503). Script kept at `/var/www/green-node/store/server/sql/drop_cart_user_fk.sql` |
| VPS blue `techxpertstore` | Re-check before blue promote; apply same script if any UserID→`users` FKs remain |

Full dual-sided handover: [`APP_TEAM_GREEN_HANDOVER.md`](./APP_TEAM_GREEN_HANDOVER.md).

---

## A. Build on laptop first

**Source of truth:** `Desktop/BLUE_GREEN/` (not Desktop `techxpert-store` / `Homecare`).

```bash
# Store API (required)
cd ~/Desktop/BLUE_GREEN/techxpert-store-main/server
npm ci
npm test          # expect all pass (314 as of PayU slice)
npm run build     # → dist/

# Optional: Store portal if you also refresh uitest
cd ../web && npm ci && VITE_API_BASE_URL=https://apitest.jiotechxpert.com npm run build
```

Homecare green is JS source — no `tsc` build; upload from `~/Desktop/BLUE_GREEN/techxpert_backend-main/` (`src/` + `sql/`) and `npm ci --omit=dev` on VPS if deps changed.

---

## B. Upload map — Store → `/var/www/green-node/store/`

Upload **whole trees** (not SQL-only). Prefer syncing these paths:

### Always (this release)

| Laptop | VPS |
|---|---|
| `server/dist/` **(entire folder after build)** | `store/server/dist/` |
| `server/package.json` | `store/server/package.json` |
| `server/package-lock.json` | `store/server/package-lock.json` |
| `server/sql/` **(entire folder, includes `checkout_idempotency.sql`, `payment_orders.sql`)** | `store/server/sql/` |
| `server/deploy/apache-api.conf` | `store/server/deploy/apache-api.conf` (reference; merge LocationMatch into live apitest vhost) |
| `server/.env.example` | optional reference only — **do not overwrite** live `.env` blindly |

### Env edits on VPS (file already there: `store/server/.env`)

**Mandatory block is in §GATE above** (OTP SMS + PayU + CORS Origins). Do not mark green live until those curls pass. Bridge vars:

```bash
HOMECARE_STORE_BRIDGE_SECRET=<same as Homecare green; min 24>
ALLOW_HOMECARE_EXCHANGE_TOKENS=false
```

### Source files that produced this `dist/` (for review; upload **dist**, not src, to prod-like green)

```
server/src/index.ts
server/src/config/bridgeAuth.ts
server/src/config/security.ts          # CORS allowlist MUST include Idempotency-Key
server/src/middleware/auth.ts
server/src/middleware/bridgeTokenAuth.ts
server/src/middleware/clientBridge.ts
server/src/middleware/rateLimit.ts
server/src/routes/auth.ts
server/src/routes/cart.ts
server/src/routes/catalog.ts
server/src/routes/delivery.ts
server/src/routes/orders.ts
server/src/routes/wishlist.ts
server/src/routes/service.ts
server/src/routes/payments.ts
server/src/services/authService.ts
server/src/services/checkoutIdempotency.ts
server/src/services/serviceOrdersService.ts
server/src/services/payuInitiateService.ts
server/src/services/payuSettlementService.ts
server/src/services/cartCheckoutService.ts
server/src/utils/activityItem.ts
server/src/utils/checkoutChannel.ts
server/src/utils/payu.ts
server/src/utils/paymentMethod.ts
server/sql/checkout_idempotency.sql
server/sql/payment_orders.sql
```

### On VPS after upload

```bash
cd /var/www/green-node/store/server
npm ci --omit=dev

mysql -u green_app -p techxpertstore_green < sql/checkout_idempotency.sql
mysql -u green_app -p techxpertstore_green < sql/payment_orders.sql

# Apache: deny public /service (both with and without /api) — see deploy/apache-api.conf
# Do NOT block /payments — PayU callbacks must reach Node.
# Then:
pm2 restart store-api-green
pm2 save
curl -sS http://127.0.0.1:5003/health
curl -sS https://apitest.jiotechxpert.com/health
```

---

## C. Upload map — Homecare → `/var/www/green-node/homecare-backend/`

| Laptop (`BLUE_GREEN/techxpert_backend-main/`) | VPS |
|---|---|
| `src/app.js` | `…/src/app.js` |
| `src/config/storeClient.js` | `…/src/config/storeClient.js` |
| `src/services/storeTokens.js` | `…/src/services/` |
| `src/services/storeApiClient.js` | `…/src/services/` |
| `src/services/featureFlags.js` | `…/src/services/` |
| `src/services/activityMerge.js` | `…/src/services/` |
| `src/services/activityMappers.js` | `…/src/services/` |
| `src/services/activityService.js` | `…/src/services/` |
| `src/routes/storeToken.js` | `…/src/routes/` |
| `src/routes/activity.js` | `…/src/routes/` |
| `sql/feature_flags.sql` | `…/sql/feature_flags.sql` |

### Env on Homecare green `.env`

```bash
HOMECARE_STORE_BRIDGE_SECRET=<same as Store green>
STORE_API_BASE_URL=http://127.0.0.1:5003
# Optional hard kill for Activity: UNIFIED_ACTIVITY_V1=0
```

### On VPS after upload

```bash
cd /var/www/green-node/homecare-backend
# npm ci --omit=dev  # if package.json changed

mysql -u green_app -p homecare_green < sql/feature_flags.sql

pm2 restart homecare-api-green
pm2 save
curl -sS https://apitest.techxpertindia.com/health
```

Enable Activity only when ready:

```sql
-- on homecare_green
UPDATE feature_flags SET enabled = 1 WHERE flag_key = 'UNIFIED_ACTIVITY_V1';
```

---

## D. Docs to share with app / ops (optional upload to green or Slack)

From `BLUE_GREEN/techxpert-store-main/docs/` (also on GitHub branch `docs/store-customer-api`):

- `APP_TEAM_GREEN_HANDOVER.md` — **503 fix + platform vs app deliverables**
- `STORE_CUSTOMER_API.md` — **this release’s route + auth bible**
- `GREEN_DEPLOY_MANIFEST.md` — this file
- `WORKSPACE_DEPLOY_CLARITY.md` — BLUE_GREEN isolation rule
- `APP_API_GUIDE.md` (use cases; still valid)
- `APP_TEAM_HANDOVER.md`
- `STORE_APP_TEAM_PROMPT.md`

---

## E. Smoke after green is live

```bash
# Store
curl -sS https://apitest.jiotechxpert.com/health
# Expect 403 from public (after Apache rule):
curl -sS -o /dev/null -w '%{http_code}\n' https://apitest.jiotechxpert.com/service/v1/orders
curl -sS -o /dev/null -w '%{http_code}\n' https://apitest.jiotechxpert.com/api/service/v1/orders

# Homecare
curl -sS https://apitest.techxpertindia.com/health

# Store Expo / Postman: send-otp → verify-otp → GET /auth/me → GET /cart → checkout
# Exchange path stays off until ALLOW_HOMECARE_EXCHANGE_TOKENS=true + Homecare store-token tested
```

---

## F. Do not

- Overwrite blue `/var/www/node-projects/...` with this pack  
- Point green `.env` at blue DB names  
- Turn `ALLOW_HOMECARE_EXCHANGE_TOKENS=true` before Homecare green has the same bridge secret  
- Enable `UNIFIED_ACTIVITY_V1` for all users before Activity UI / Store S2S proof  
