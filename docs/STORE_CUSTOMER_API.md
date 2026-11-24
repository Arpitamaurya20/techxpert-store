# Store customer API — full route list (auth & protection)

**Audience:** Store Expo app, Homecare app team, green deploy  

### Base URL (mandatory for current app work)

| | Host |
|---|---|
| **USE NOW** | `https://apitest.jiotechxpert.com` (also `/api/...` — same routers) |
| **DO NOT USE for this slice** | `https://store.jiotechxpert.com` (blue/prod — only after promote) |

```bash
EXPO_PUBLIC_API_BASE_URL=https://apitest.jiotechxpert.com/api
```

If the app is still calling `store.jiotechxpert.com`, change the base URL before filing auth bugs.

**Identity:** Shared `homecare.users` — one phone login is one `user_id` for Homecare bookings **and** Store materials.

### Separate checkouts, one login (locked for now)

| Checkout | Who owns money/rules | Auth today |
|---|---|---|
| Homecare services (booking / PayU) | Homecare API | Homecare JWT (cookie or Bearer) |
| Store materials (COD **or** PayU) | **This Store API** | Store JWT (Expo) **or** Homecare-minted exchange token (Mode B) |
| Combo / soft bundle | Later (Phase 2) | Not in this doc |

Same DB identity; **cross-cart / combo is out of scope**. Each domain keeps its own cart and checkout. Store PayU uses **Store** merchant keys and `/payments/payu/*` on this host — never Homecare’s payment APIs.

Related: use-case narrative in [`APP_API_GUIDE.md`](./APP_API_GUIDE.md); contracts in [`contracts/unified-commerce-phase-0-1.md`](./contracts/unified-commerce-phase-0-1.md); green upload list in [`GREEN_DEPLOY_MANIFEST.md`](./GREEN_DEPLOY_MANIFEST.md); agent review of this slice in [`STORE_APP_TEAM_PROMPT.md`](./STORE_APP_TEAM_PROMPT.md).

---

## 1. Auth model (this server)

| Token | How you get it | Header | Lifetime |
|---|---|---|---|
| **Store customer JWT** | `POST /auth/verify-otp` on **Store** | `Authorization: Bearer <token>` | 30 days |
| **Homecare exchange** | Homecare `POST /api/auth/store-token`, then call **Store** | Same Bearer | 15 minutes |
| **S2S bridge** | Homecare server only | Bearer on `/service/v1/*` | 60 seconds |
| Guest | No Bearer | `x-session-id: <stable uuid>` on cart/wishlist | — |

**Protection labels used below**

| Label | Meaning |
|---|---|
| Public | No auth |
| Guest+ | Optional Bearer or `x-session-id` |
| Customer | Store JWT **or** scoped exchange (after `allowClientBridge`) |
| Customer (Store JWT only) | Exchange **forbidden** (profile / addresses / wishlist) |
| Staff | Portal staff session — not for apps |
| Internal S2S | Homecare→Store loopback only; Apache must 403 publicly |

Exchange tokens are **default-deny**: they only act as the customer on routes marked with an exchange scope. Kill switch: Store env `ALLOW_HOMECARE_EXCHANGE_TOKENS=true` (default off).

---

## 2. Customer / app routes (complete list)

Every path also exists under `/api/...`.

### Health

| Method | Path | Auth |
|---|---|---|
| GET | `/health` | Public |

### Auth (`/auth`)

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/auth/send-otp` | Public | Rate-limited; body `{ phone, purpose? }`. **Production needs PRP OTP env** or response is **503** (SMS not sent). |
| POST | `/auth/verify-otp` | Public | Rate-limited → `{ token, user }` |
| POST | `/auth/login` | Public (dev only) | **403** when `NODE_ENV=production` — apps must use OTP. |

**Login troubleshooting (app team):** “Login 503” almost always means `send-otp` could not send SMS (`OTP_SMS_PROVIDER` / `PRP_SMS_*` missing on the Store host). It is **not** a client bug and **not** a MySQL outage if `/health` is 200. See [`APP_TEAM_GREEN_HANDOVER.md`](./APP_TEAM_GREEN_HANDOVER.md) §0.
| GET | `/auth/me` | Customer (Store JWT only) | |
| GET | `/auth/addresses` | Customer (Store JWT only) | `homecare.user_addresses` |
| POST | `/auth/addresses` | Customer (Store JWT only) | |
| PUT | `/auth/addresses/:id/default` | Customer (Store JWT only) | |
| DELETE | `/auth/addresses/:id` | Customer (Store JWT only) | Soft delete |
| POST | `/auth/admin/login` | Staff | Portal |
| GET | `/auth/admin/me` | Staff | Portal |
| … | other `/auth/admin/*` | Staff | Portal |

### Catalog (`/catalog`) — browse

| Method | Path | Auth | Exchange scope |
|---|---|---|---|
| GET | `/catalog/categories` | Public / optional Bearer | `catalog` if exchange sent |
| GET | `/catalog/products` | Public / optional | `catalog` |
| GET | `/catalog/products/:id` | Public / optional | `catalog` |
| GET | `/catalog/search/suggest` | Public / optional | `catalog` |
| Staff mutations | POST/PUT/DELETE categories, products, images, … | Staff | — |

### Delivery (`/delivery`)

| Method | Path | Auth | Exchange scope |
|---|---|---|---|
| GET | `/delivery/pincodes/:pincode` | Public / optional | `delivery` |
| GET/POST/PATCH | `/delivery/pincodes` … | Staff | — |

### Cart (`/cart`)

| Method | Path | Auth | Exchange scope |
|---|---|---|---|
| GET | `/cart` | Guest+ | `cart` |
| GET | `/cart/summary` | Guest+ | `cart` |
| PUT | `/cart/items/:productId` | Guest+ | `cart` |
| POST | `/cart/items` | Guest+ (legacy) | `cart` |
| DELETE | `/cart/items/:id` | Guest+ (legacy) | `cart` |
| DELETE | `/cart` | Guest+ | `cart` |
| POST | `/cart/reorder` | Guest+ (needs user for reorder) | `cart` |
| POST | `/cart/merge` | **Customer** | `cart` |
| POST | `/cart/checkout` | Guest+ / Customer | `cart` + `checkout` |

Checkout body: `expectedTotal` required; `paymentMethod` = `"COD"` (default) or `"PayU"`. Signed-in prefer `addressId`; guests send `shippingAddress` + `guestName` + `guestPhone` (**PayU requires signed-in**). Optional `Idempotency-Key`. Exchange forces `order_channel=homecare_app`.

PayU place → order `paymentStatus=pending`, `status=pending` (awaiting payment) → then call `/payments/payu/initiate`.

### Payments (`/payments`) — PayU

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/payments/payu/initiate` | Customer | Body `{ orderId, client?: "app"\|"web" }` → `{ payuPayload, checkout_html?, txnid, … }` |
| POST | `/payments/payu/success` | Public (PayU POST) | `application/x-www-form-urlencoded`; hash verified; settles paid |
| POST | `/payments/payu/failure` | Public (PayU POST) | urlencoded; marks failed when txn known |
| POST | `/payments/payu/verify` | Customer | Body `{ orderId }` or `{ txnid }` — reconcile via PayU verify API (WebView miss) |

Green `surl`/`furl` point at apitest `/payments/payu/success` and `/failure` (also under `/api/...`). App team opens PayU with `payuPayload` or loads `checkout_html` in a WebView; after return call verify then `GET /orders/:id`.

**Abandoned PayU:** unpaid orders stay pending/failed; staff cancel restores stock. No auto-cancel job yet.

### Orders (`/orders`)

| Method | Path | Auth | Exchange scope |
|---|---|---|---|
| GET | `/orders` | Customer (list own) | `orders` |
| GET | `/orders/again` | Customer | `orders` |
| GET | `/orders/:id` | Customer (owner) | `orders` |
| POST | `/orders/:id/problem` | Customer | `orders` |
| POST | `/orders` | Guest+/Customer | **Exchange forbidden** (use `/cart/checkout`) |
| GET | `/orders/stats` | Staff | — |
| POST | `/orders/staff` | Staff | — |
| PUT | `/orders/:id/status` … | Staff | — |

### Wishlist (`/wishlist`)

| Method | Path | Auth | Exchange |
|---|---|---|---|
| GET | `/wishlist` | Guest+ | **Forbidden** |
| PUT | `/wishlist/:productId` | Guest+ | **Forbidden** |
| POST | `/wishlist/merge` | Customer | **Forbidden** |

### CMS / shop (customer reads)

| Method | Path | Auth |
|---|---|---|
| GET | `/cms/home-boot`, `/cms/home`, `/cms/banners`, `/cms/sections`, … | Public (some optional staff enrichment) |
| GET | `/shop/...` help, about, policies, deals, talk-to-us | Public / as documented in APP_API_GUIDE |
| GET | `/pricing/bulk-tiers` | Public |

### Internal (not for Store Expo / not public)

| Method | Path | Auth |
|---|---|---|
| GET | `/service/v1/orders` | S2S only (`aud` `techxpert-store-s2s`, scope `orders:read`) |

Public host must return **403** for `/service` and `/api/service` (Apache). Homecare calls `http://127.0.0.1:5003/service/v1/orders`.

---

## 3. Homecare companions (same login, other host)

Green Homecare API: `https://apitest.techxpertindia.com`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/store-token` | Homecare customer JWT | Mint 15m Store exchange token |
| GET | `/api/activity` | Homecare customer JWT | Unified Activity (flag `UNIFIED_ACTIVITY_V1`) |

Store Expo does **not** call these.

---

## 4. Quick Mode B sequences

**Store Expo (materials, COD)**  
`send-otp` → `verify-otp` → Bearer → catalog → cart → `GET /delivery/pincodes/:pin` → `POST /cart/checkout` (`paymentMethod: "COD"`) → `GET /orders`

**Store Expo (materials, PayU)**  
Same through cart → `POST /cart/checkout` (`paymentMethod: "PayU"`) → `POST /payments/payu/initiate` `{ orderId }` → open PayU (`payuPayload` / `checkout_html`) → on return `POST /payments/payu/verify` → `GET /orders/:id` (`paymentStatus: paid`)

**Homecare app materials (when flag + exchange on)**  
Homecare OTP → `POST /api/auth/store-token` → Store Bearer (exchange) → same Store catalog/cart/checkout paths (no `channel` in body) → addresses stay on Homecare APIs; pass Store `addressId`

**Homecare services**  
Unchanged Homecare cart/booking/PayU — separate checkout.

---

## 5. Envelope

Most routes: `{ "success": true, "data": …, "meta": … }` or `{ "success": false, "error": "…" }`.  
`verify-otp` returns `{ token, user }` at the top level (app contract).
