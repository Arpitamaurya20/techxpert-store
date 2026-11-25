# Green deploy manifest — unified commerce + Store auth (go-live pack)

**What this ships:** Store customer auth hardened + Homecare↔Store bridge + **Store PayU** (initiate/success/failure/verify) + SQL.  
**What this does not ship:** Expo PayU UI (app team); Combo / Mode C; Ionic Activity UI.

**Same login, separate checkouts:** one `homecare.users.user_id`; Homecare booking PayU stays on Homecare; Store materials COD/PayU on this API.

API route list for apps: [`STORE_CUSTOMER_API.md`](./STORE_CUSTOMER_API.md).

---

## A0. Login 503 blocker (fix before / while deploying)

App “login” failures that return **503** + `"The sign-in code could not be sent…"` are **`POST /auth/send-otp`**, not `/auth/login`.

Cause: Store host missing PRP OTP env (or PRP rejected). Health can still be 200.

On VPS Store `.env` (blue and/or green), set Homecare’s OTP credentials, then restart PM2:

```bash
OTP_SMS_PROVIDER=prp
PRP_SMS_API_KEY=<same as Homecare>
PRP_SMS_SENDER=TECHX
PRP_SMS_TEMPLATE_NAME=TECHXPERT OTP
```

`POST /auth/login` returning **403** on production is **correct** — apps use send-otp → verify-otp only.

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

```bash
# Add / set (same secret Homecare green will use; min 24 chars):
HOMECARE_STORE_BRIDGE_SECRET=<long-random-shared-secret>

# Keep off until Homecare mint + CORS ready:
ALLOW_HOMECARE_EXCHANGE_TOKENS=false

# Store PayU (test merchant — not Homecare keys):
PAYU_MERCHANT_KEY=<store-test-key>
PAYU_MERCHANT_SALT=<store-test-salt>
PAYU_BASE_URL=https://test.payu.in/_payment
PAYU_SUCCESS_URL=https://apitest.jiotechxpert.com/payments/payu/success
PAYU_FAILURE_URL=https://apitest.jiotechxpert.com/payments/payu/failure
# APP_PAYU_RETURN_URL=techxpertstore://payu-return

# OTP — required or every production send-otp is 503 (§A0)
OTP_SMS_PROVIDER=prp
PRP_SMS_API_KEY=<same as Homecare>
PRP_SMS_SENDER=TECHX
PRP_SMS_TEMPLATE_NAME=TECHXPERT OTP

# Already expected:
PORT=5003
HOST=127.0.0.1
DB_USERS=homecare_green
DB_STORE=techxpertstore_green
PUBLIC_API_ORIGIN=https://apitest.jiotechxpert.com
CORS_ORIGINS=https://uitest.jiotechxpert.com,https://uitest.techxpertindia.com
# Later: add real Capacitor Origins from app team
```

### Source files that produced this `dist/` (for review; upload **dist**, not src, to prod-like green)

```
server/src/index.ts
server/src/config/bridgeAuth.ts
server/src/config/security.ts          # unchanged unless you edited
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
server/sql/carts_userid_logical_fk.sql
```

### On VPS after upload

```bash
cd /var/www/green-node/store/server
npm ci --omit=dev

mysql -u green_app -p techxpertstore_green < sql/checkout_idempotency.sql
mysql -u green_app -p techxpertstore_green < sql/payment_orders.sql

# Signed-in cart 500: drop any real FK on carts.UserID (logical ref to homecare only).
mysql -u green_app -p techxpertstore_green < sql/carts_userid_logical_fk.sql
# Then DROP FOREIGN KEY for each CONSTRAINT_NAME the SELECT returns (see file comments).

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
