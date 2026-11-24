# Unified commerce — Task 0 discovery notes

**Status:** Signed off for Task 1 (proceed-to-dev 24 Nov 2026). Store green restored (`apitest` + `:5003` health ok, DBs `*_green`). Live G4 COD still optional to paste.  
**Date:** 24 Nov 2026  
**Repos audited:** `~/Desktop/techxpert-store` (`develop`), `~/Desktop/Homecare`  
**Design / plan:** [`../superpowers/specs/2026-11-20-unified-commerce-design.md`](../superpowers/specs/2026-11-20-unified-commerce-design.md), [`../superpowers/plans/2026-11-20-unified-commerce-phase-0-1.md`](../superpowers/plans/2026-11-20-unified-commerce-phase-0-1.md)

Do **not** start Task 2 (Store bridge verifier) until this file is signed off below.

---

## Store JWT

**Source:** `server/src/services/authService.ts` (`verifyOtp` / attach path), `server/src/middleware/auth.ts`, `server/src/config/security.ts`.

| Item | Finding |
|---|---|
| User-id claim | **`userId`** (number) = `homecare.users.user_id` |
| Other claims | `mobile`, `email`, `name` (customer OTP path) |
| Expiry | **`30d`** (`expiresIn: '30d'`) |
| Refresh tokens | **None** for Store customers (30-day access token only) |
| Verifier today | **Single** `jwt.verify(token, JWT_SECRET)` in `claimsFrom()` via `getJwtSecret()` — one secret, no `iss`/`aud` checks on customer tokens |
| Extraction | `Authorization: Bearer …` first; staff portal also accepts HttpOnly admin cookie |
| Staff separation | Portal staff tokens use audience `STAFF_TOKEN_AUDIENCE`; `staffId` only from that audience |

**Implication for Phase 0–1:** Add a **second** verifier (`bridgeTokenAuth`) for Homecare-minted HS256 tokens with a dedicated `HOMECARE_STORE_BRIDGE_SECRET`. Do not overload `JWT_SECRET` or customer claim shape.

---

## Homecare JWT

**Source:** `Homecare/backend/src/services/tokenService.js`, `middleware/auth.js`, `routes/auth.js` verify-otp; customer-app handoff `briefs/CUSTOMER_APP_FULL_CONTEXT_HANDOFF.md`; web `frontend/src/redux/api/authApi.js`.

| Item | Finding |
|---|---|
| User-id claim | **`sub`** = `String(user.user_id)` (same `homecare.users.user_id`) |
| Middleware maps to | `req.user.id` (= decoded `sub`), plus `phone`, `role` |
| Access TTL | Default **`1d`** (`JWT_EXPIRES_IN` or `'1d'`); cookie maxAge = JWT + 5 min buffer |
| Refresh | **Yes** — opaque refresh token in DB + `refresh_token` cookie / JSON body |
| Issuer / audience | `iss: 'techxpert-api'`, `aud: 'techxpert-client'` |
| Secret | Homecare `JWT_SECRET` (separate from Store) |

### Ionic vs web (G1)

| Client | How auth is held | How to call `POST /api/auth/store-token` |
|---|---|---|
| **Homecare web (React)** | HttpOnly **`access_token` cookie**; `credentials: 'include'` | Cookie session is enough (same-site / CORS credentials) |
| **Techxpert Ionic/Capacitor customer app** | **Raw Bearer** from verify-otp JSON (`access_token`); handoff: “Web cookies are not enough for the app” | Send `Authorization: Bearer <access_token>` |

**Identity join:** Store `userId` and Homecare `sub` / `req.user.id` are the same `homecare.users.user_id` for a given phone (Store OTP attaches into `homecare.users`).

---

## Address parity and pincode (G2)

Both sides read/write **`homecare.user_addresses`**.

| | Homecare | Store |
|---|---|---|
| List | `GET /api/customers/get-addresses` → `address_id`, `flat_no`, `building`, `area`, `city`, `pincode`, … | `GET /auth/addresses` → `id` (= `address_id`), `flatNo`, `building`, `area`, `city`, `pincode`, … |
| Checkout key | Bookings use `address_id` | `POST /cart/checkout` `addressId` |

**Store resolution** (`OrderService.resolveDeliveryAddress`):

```sql
SELECT … FROM homecare.user_addresses
 WHERE address_id = ? AND user_id = ? AND is_deleted = 0
```

So the same numeric `address_id` from Homecare’s customer API is valid as Store `addressId` for the same `user_id`.

**Pincode before money:** `CartCheckoutService.place` calls `DeliveryAreaService.assertServiceable(deliveryPincode(…))` **before** opening the order transaction. Public probe: `GET /delivery/pincodes/:pincode`. Clients should still call the public check for UX; server enforces at checkout.

**Field mapping (Homecare → Store checkout)**

| Homecare | Store checkout / cart |
|---|---|
| `address_id` | `addressId` |
| `pincode` (on address row) | Used via resolved address; optional body `pincode` fallback |
| (n/a) | `expectedTotal` required; `channel` body today (token claim later) |

**G2:** **Yes** — same `address_id` / `user_id` pair; pincode gate runs inside checkout.

---

## Channel end to end (G4)

**Code path (today, body-driven):**

1. `POST /cart/checkout` body may include `"channel": "homecare_app"`.
2. `CartCheckoutService.place` → `readOrderChannel(body.channel, 'store_app')` (`server/src/utils/orderChannel.ts`).
3. `OrderService.writeOrder` → `rememberChannel` → `INSERT INTO order_channel (OrderID, Channel)`.
4. Schema: `server/sql/order_channel.sql` — `ENUM('store_app','homecare_app')`.
5. Unit test: `server/src/utils/orderChannel.test.ts` asserts `homecare_app` is kept.

**Exact request shape (expected; live green run pending):**

```http
POST /cart/checkout
Authorization: Bearer <store_customer_jwt>
Content-Type: application/json

{
  "cartId": <n>,
  "expectedTotal": <rupees>,
  "addressId": <homecare.user_addresses.address_id>,
  "paymentMethod": "COD",
  "channel": "homecare_app"
}
```

Then: `SELECT Channel FROM order_channel WHERE OrderID = ?` → `homecare_app`.

**Live proof status (24 Nov 2026):**

| Target | Result |
|---|---|
| `https://apitest.jiotechxpert.com/health` | **503** (Store green Node/proxy down) |
| `https://store.jiotechxpert.com/health` | **200** (blue healthy — do not use for Phase 0 experiments) |
| Local Store `127.0.0.1:5001` / `5003` | Not running on this laptop |

**G4:** **Yes in code + unit test.** Live COD on **green** still required once Store green is healthy; record the real order id here when done. Exchange-token force of channel is Task 3, not this spike.

---

## Activity sources

### Bookings — `GET /api/bookings/get_user_bookings`

Auth: Homecare customer JWT. Pagination: **page/limit** (not keyset). Order: `b.created_at DESC`.

Redacted shape (fields used for Activity):

```json
{
  "bookings": [
    {
      "booking_id": 12345,
      "booking_ref": "BK-…",
      "status": "confirmed",
      "final_amount": 799.0,
      "total_amount": 799.0,
      "payment_status": "paid",
      "created_at": "2026-11-01T10:00:00.000Z",
      "scheduled_date": "2026-11-05",
      "service_names": "AC Service",
      "visits": []
    }
  ],
  "total": 1,
  "page": 1,
  "pages": 1
}
```

**Cursor notes:** Index `IX_bookings_user (user_id, status, scheduled_date)` — **not** `(user_id, created_at)`. Activity compose should add a keyset query `(user_id, created_at, booking_id)` or accept a new index in Homecare migrations. Page/offset is poor for merge cursors.

### Leads — `GET /api/leads` (list for user)

`listLeadsForUser`: `ORDER BY created_at DESC`, page/limit.

```json
{
  "leads": [
    {
      "ticket_id": 678,
      "lead_ref": "LD-…",
      "ticket_ref": "…",
      "status": "quote_sent",
      "service_name": "Painting",
      "visit_fee": 99,
      "visit_fee_status": "paid",
      "created_at": "2026-11-02T08:00:00.000Z",
      "updated_at": "2026-11-03T12:00:00.000Z",
      "job_tracker_url": "…"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20
}
```

**Cursor notes:** `lead_tickets.user_id` exists (schema guard). Early migration had no `(user_id, created_at)` index — verify on green DB; add if missing before Activity load test.

### Store orders (for Activity S2S later)

Today: `GET /orders` page/limit. Phase 0 adds `GET /service/v1/orders` with `before` cursor — not present yet.

---

## Network and Apache (G3)

| Item | Finding |
|---|---|
| Topology | Homecare + Store on **same VPS** (blue under `/var/www/node-projects/`, green under `/var/www/green-node/`) |
| Green Store port | `127.0.0.1:5003` (`techxpert-api-green`) |
| Green Homecare port | `127.0.0.1:5004` (`homecare-api-green`) |
| S2S base (planned) | Homecare → `http://127.0.0.1:5003` (never public host) |
| Homecare green health | `GET https://apitest.techxpertindia.com/health` → **200**, `db: connected`, storage under green-node |
| Store green health | `GET https://apitest.jiotechxpert.com/health` → **503** — Apache up, upstream Store green process likely down |
| Blue Store sample Apache | `server/deploy/apache-api.conf` proxies `/` → `127.0.0.1:5001`; **no** public `/service` 403 yet (add on green apitest when Task 2 lands) |

**G3:** **Yes** (same host / localhost). Confirm `curl http://127.0.0.1:5003/health` from Homecare process after Store green is restarted.

---

## Real Capacitor origins (Step 7)

Customer Ionic app source is **not** in this workspace (separate app-team repo). From Homecare briefs:

- Stack: **Ionic Angular 17 + Capacitor 8**
- Auth: Bearer (not cookie)

| Platform | Origin to record | Status |
|---|---|---|
| Android (dev / release) | Depends on `server.androidScheme` (`https` → often `https://localhost`; `http` → `http://localhost`) | **Ask app team** — paste real `Origin` from a Store catalog `OPTIONS`/XHR |
| iOS (dev / release) | Often `capacitor://localhost` or `ionic://localhost` | **Ask app team** |

**Store `CORS_ORIGINS` today (green template in `docs/BLUE_GREEN.md`):**

```text
https://uitest.jiotechxpert.com,https://uitest.techxpertindia.com
# Add Capacitor origins when app team supplies them
```

Local non-production Store allows any origin / localhost regex when `CORS_ORIGINS` empty. Production **requires** explicit allowlist (`getCorsOptions()`).

**Env vars for Phase 1 direct Store calls from Ionic:**

- Store: `CORS_ORIGINS` += real Capacitor origins; later `HOMECARE_STORE_BRIDGE_SECRET`, `ALLOW_HOMECARE_EXCHANGE_TOKENS`
- Homecare: `STORE_API_BASE_URL=http://127.0.0.1:5003` (S2S only); public Store URL for the app is `https://apitest.jiotechxpert.com` on green

---

## Token verification feasibility (Step 8)

**Can Store verify a second HS256 secret alongside its own?** **Yes.**

- `jsonwebtoken` already used; `bridgeTokenAuth` can `jwt.verify(token, HOMECARE_STORE_BRIDGE_SECRET, { algorithms: ['HS256'], issuer, audience })` without changing customer `JWT_SECRET` verification.
- Keep exchange tokens **out** of `requireAdmin` / staff cookie paths (reject missing/wrong `aud` / missing `userId`-style mapping — map `sub` → internal customer id).
- Kill switch: `ALLOW_HOMECARE_EXCHANGE_TOKENS` default `false`.

**Task 6 proxy fallback:** **Not indicated** by verifier limits. Only revisit if Ionic cannot hold/send the 15-minute Store client token (unlikely given existing Bearer OTP).

**Task 6 decision (24 Nov 2026):** **Skipped.** Store dual verifier works; Ionic holds Bearer. Direct exchange-token path is the Phase 1 default.

---

## Exit criteria (Step 9)

| # | Gate | Answer | Evidence |
|---|---|---|---|
| 1 | **G1** claim names; Ionic Bearer or cookie | Store **`userId`**; Homecare **`sub`** → `req.user.id`. Ionic = **Bearer**; web = **cookie** | authService / tokenService / customer-app handoff |
| 2 | **G2** same `address_id` on Store checkout | **Yes** | Both use `homecare.user_addresses`; `resolveDeliveryAddress` |
| 3 | **G3** same host / `127.0.0.1:5003` | **Yes** (topology); Store green process **needs restart** | BLUE_GREEN.md; Homecare green health 200; Store apitest 503 |
| 4 | **G4** `homecare_app` checkout | **Yes in code/tests**; **live green COD pending** | cartCheckoutService + order_channel + unit test |
| 5 | Capacitor origins + env | **Partial** — template known; real Origins from app team | BLUE_GREEN CORS note; Step 7 table |
| 6 | Second verifier possible | **Yes** | Separate secret + middleware; no Task 6 needed for this reason |

### Ops before app-team green Mode B / Task 2 deploy

1. Restore Store green: `curl -sS http://127.0.0.1:5003/health` on VPS → public `https://apitest.jiotechxpert.com/health` **200**.
2. Optional: one green COD with `channel=homecare_app`; paste OrderID + Channel into this file.
3. App team: reply with Android/iOS `Origin` strings for `CORS_ORIGINS`.

### Sign-off

| Role | Name | Date | Notes |
|---|---|---|---|
| Engineering | | | |
| Product (optional) | | | |

**After sign-off:** Task 1 (contract + fixtures) → Task 2 (Store S2S verifier + `/service/v1/orders`). Soft-bundle / combo checkout stays Phase 2.
