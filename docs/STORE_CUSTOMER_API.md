# Store customer API — full route list (auth & protection)

**Audience:** Store Expo app, Homecare app team, green deploy  
**Base (green):** `https://apitest.jiotechxpert.com` (also `/api/...` — same routers)  
**Base (blue/prod):** `https://store.jiotechxpert.com`  
**Identity:** Shared `homecare.users` — one phone login is one `user_id` for Homecare bookings **and** Store materials.

### Separate checkouts, one login (locked for now)

| Checkout | Who owns money/rules | Auth today |
|---|---|---|
| Homecare services (booking / PayU) | Homecare API | Homecare JWT (cookie or Bearer) |
| Store materials (COD cart) | **This Store API** | Store JWT (Expo) **or** Homecare-minted exchange token (Mode B) |
| Combo / soft bundle | Later (Phase 2) | Not in this doc |

Same DB identity; **cross-cart / combo is out of scope**. Each domain keeps its own cart and checkout.

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
| POST | `/auth/send-otp` | Public | Rate-limited; body `{ phone, purpose? }` |
| POST | `/auth/verify-otp` | Public | Rate-limited → `{ token, user }` |
| POST | `/auth/login` | Public (dev only) | Refused when `NODE_ENV=production` |
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

Checkout body (COD): `expectedTotal` required; signed-in prefer `addressId`; guests send `shippingAddress` + `guestName` + `guestPhone`. Optional `Idempotency-Key`. Exchange forces `order_channel=homecare_app`.

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

**Store Expo (materials only)**  
`send-otp` → `verify-otp` → Bearer → catalog → cart → `GET /delivery/pincodes/:pin` → `POST /cart/checkout` → `GET /orders`

**Homecare app materials (when flag + exchange on)**  
Homecare OTP → `POST /api/auth/store-token` → Store Bearer (exchange) → same Store catalog/cart/checkout paths (no `channel` in body) → addresses stay on Homecare APIs; pass Store `addressId`

**Homecare services**  
Unchanged Homecare cart/booking/PayU — separate checkout.

---

## 5. Envelope

Most routes: `{ "success": true, "data": …, "meta": … }` or `{ "success": false, "error": "…" }`.  
`verify-otp` returns `{ token, user }` at the top level (app contract).
