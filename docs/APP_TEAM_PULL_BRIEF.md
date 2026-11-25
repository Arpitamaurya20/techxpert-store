# App team — pull brief + verification checklist

**Audience:** Store Expo / app engineers who just pulled (or will pull) the Store docs + build against green.  
**Pasteable “prompt”:** §1 — give this to anyone (or another agent) so they know what landed and what to verify.  
**Your job:** wire the Expo app to these APIs. **Not your job:** Homecare backend source, VPS uploads, Mode C combo.

## Host map (blue + green) — route by service

This is **not** “all traffic to green” or “never blue”. Use **two Store bases** until ops promotes the green slice:

| Alias | Host |
|---|---|
| **GREEN Store** | `https://apitest.jiotechxpert.com` (paths also under `/api/...`) |
| **BLUE Store** | `https://store.jiotechxpert.com` |
| **GREEN Homecare** | `https://apitest.techxpertindia.com` — Homecare app only (not Store Expo) |
| **BLUE Homecare** | live Homecare API hosts — Homecare booking / Homecare PayU (unchanged) |

Suggested Expo env (names illustrative — match your client):

```bash
EXPO_PUBLIC_API_BASE_URL=https://store.jiotechxpert.com/api          # BLUE — default / existing
EXPO_PUBLIC_GREEN_API_BASE_URL=https://apitest.jiotechxpert.com/api  # GREEN — today’s live slice only
```

### What went live on green today → call **GREEN** only for these

| Service / flow | Methods & paths (GREEN Store) |
|---|---|
| Customer OTP login | `POST /auth/send-otp`, `POST /auth/verify-otp` |
| Session after green login | `GET /auth/me` |
| Addresses when using green JWT | `GET/POST /auth/addresses`, `PUT/DELETE /auth/addresses/...` |
| Cart that will checkout on green | `GET/PUT/POST/DELETE /cart…`, `POST /cart/merge` |
| Delivery check before green checkout | `GET /delivery/pincodes/:pincode` |
| COD / PayU checkout (new + idempotency) | `POST /cart/checkout` (`paymentMethod` `COD` \| `PayU`, optional `Idempotency-Key`) |
| Store PayU | `POST /payments/payu/initiate`, `POST /payments/payu/verify` (+ PayU redirects hit GREEN callbacks) |
| Orders placed on green | `GET /orders`, `GET /orders/:id`, reorder against GREEN |

### Everything else → keep **BLUE**

| Service / flow | Methods & paths (BLUE Store) |
|---|---|
| Browse / taxonomy | `GET /catalog/...` |
| Home / CMS | `GET /cms/home-boot`, `/cms/banners`, `/cms/sections`, `/cms/home`, `/cms/search-suggestions` |
| Search | `GET /catalog/products?search=…`, `GET /catalog/search/suggest` |
| Wishlist / saved | `/wishlist` (or saved-items) as you already use on prod |
| Help / about / policies / talk-to-us | existing BLUE routes |
| Any flow **not** listed in the green table above | BLUE |

### Rules when mixing hosts

1. **JWT is host-scoped.** Token from GREEN `verify-otp` → `Authorization` only on GREEN. Do not send it to BLUE (and vice versa).  
2. **Cart is host-scoped.** Green checkout must use a cart built on GREEN (same `x-session-id` / user on GREEN).  
3. **OTP login for the green slice** must hit GREEN `send-otp` / `verify-otp` — calling BLUE `store.jiotechxpert.com/auth/send-otp` does not exercise today’s green go-live.  
4. Payload `{ "phone": "<10 digits>" }` is correct on either host; wrong **host for that service** is the bug when testing green auth/PayU.

**Platform go-live gates (not app bugs):** Store green needs its **own** OTP SMS + PayU env, and `dist` CORS must allow `Idempotency-Key`. Homecare green `.env` does not count. If `send-otp` is 503 or checkout shows CORS on `localhost:8081`→apitest, ping platform — see [`GREEN_DEPLOY_MANIFEST.md`](./GREEN_DEPLOY_MANIFEST.md) **§GATE**.

**Read after pull (in order):**

1. This file — **host map** above  
2. [`APP_TEAM_GREEN_HANDOVER.md`](./APP_TEAM_GREEN_HANDOVER.md) §0a + §0  
3. [`STORE_CUSTOMER_API.md`](./STORE_CUSTOMER_API.md) — route bible + host column  
4. [`APP_API_GUIDE.md`](./APP_API_GUIDE.md) — UC-10 COD + **UC-10b PayU**  
5. [`APP_TEAM_HANDOVER.md`](./APP_TEAM_HANDOVER.md) — Expo folder map / COD baseline  

If a linked file is missing on your branch, ask for the docs PR / `docs/store-customer-api` or green Store docs commit — do not invent routes.

---

## 1. Prompt (paste to a teammate or agent)

```text
You are helping the Store Expo app team after a Git pull of Techxpert Store docs / contract updates.

CONTEXT
- One shared customer identity with Homecare (`homecare.users` / same phone → same user_id).
- Separate checkouts: Store owns materials (COD and PayU on the Store API). Homecare owns service bookings on the Homecare API. No combo cart.
- Dual host during transition: GREEN https://apitest.jiotechxpert.com for today’s live slice (OTP, green cart/checkout, PayU, green orders). BLUE https://store.jiotechxpert.com for catalog/CMS/search/wishlist and other existing prod flows. See host map in APP_TEAM_PULL_BRIEF.md.
- Wire per-service base URLs (or a router): do not send green OTP traffic to store.jiotechxpert.com; do not require all browse traffic on apitest.
- Auth for green slice = GREEN send-otp → verify-otp → Bearer on GREEN only. Do NOT call Homecare /api/auth/store-token from Store Expo (Homecare app Mode B later).
- PayU is order-first on GREEN: POST /cart/checkout paymentMethod "PayU" → POST /payments/payu/initiate → open PayU → POST /payments/payu/verify → GET /orders/:id. COD same checkout with "COD".
- Backend/API owners ship APIs + docs only; you wire Expo (session, WebView/browser for PayU, screens).

AFTER PULL
1. Read the host map in docs/APP_TEAM_PULL_BRIEF.md and route each call to GREEN or BLUE accordingly.
2. Tick the verification checklist (green rows against apitest; blue browse can stay on store.jiotechxpert.com).
3. Follow docs/STORE_CUSTOMER_API.md for auth labels (Customer vs Guest+ vs public).

OUT OF SCOPE FOR YOU
- Homecare Activity UI, Homecare PayU, S2S /service, Apache, VPS .env, Mode C.
```

---

## 2. What was built (so you know what “done” means on the API side)

| Area | Built for you | You still build in Expo |
|---|---|---|
| OTP login | `POST /auth/send-otp`, `POST /auth/verify-otp` → `{ token, user }` | Persist JWT (SecureStore), hydrate `/auth/me`, clear on 401 |
| Profile / addresses | `/auth/me`, `/auth/addresses*` (Store JWT only) | Address picker; send `addressId` at checkout |
| Catalog / cart / delivery | Existing public + cart routes; guest `x-session-id` | Browse, cart UI, pincode check |
| COD checkout | `POST /cart/checkout` `paymentMethod: "COD"` | Place-order screen (already expected) |
| PayU checkout | Same checkout with `"PayU"` + `/payments/payu/*` | Method choice, WebView/browser, verify + refresh order |
| Orders | `GET /orders`, `GET /orders/:id`, again | History / detail |
| Docs | Route bible + UC-10 / UC-10b | Follow envelopes and error strings |

**Not built for Store Expo (ignore unless Homecare app):** Homecare `store-token`, Unified Activity, `/service/*`.

---

## 3. Verification checklist (tick from your end)

Prefer a real device / Expo build. Use **GREEN** (`apitest…`) for §B–E; **BLUE** (`store.jiotechxpert.com`) may remain for catalog/CMS browse.

### A. Pull & docs

- [ ] Pulled the branch/PR that contains `docs/STORE_CUSTOMER_API.md` and APP_API_GUIDE UC-10b  
- [ ] Read §1 prompt + **host map** in this checklist  
- [ ] App can call GREEN for today’s slice and BLUE for the rest (two bases or equivalent router)  
- [ ] Network log: green OTP/checkout/PayU → `apitest.jiotechxpert.com`; catalog/CMS → `store.jiotechxpert.com` (until promote)  

### B. Health & auth (GREEN)

- [ ] `GET https://apitest.jiotechxpert.com/health` → 200, both DBs ok  
- [ ] `POST …/auth/send-otp` on **GREEN** `{ "phone": "<10-digit>" }` → success  
- [ ] `POST …/auth/verify-otp` on **GREEN** → top-level `{ token, user }`  
- [ ] `GET …/auth/me` on **GREEN** with that Bearer → 200  
- [ ] Same Bearer against BLUE `/auth/me` is **not** required to work (do not mix)  
- [ ] App: after 401 on green session, clear green token / show signed-out for that slice  

### C. Addresses & cart

- [ ] `GET /auth/addresses` with Bearer → list (or empty)  
- [ ] `POST /auth/addresses` → create; can set default  
- [ ] Guest cart works with stable `x-session-id`  
- [ ] After login, `POST /cart/merge` (or your flow) merges guest → user cart  
- [ ] `GET /delivery/pincodes/:pin` matches checkout pincode rules  

### D. COD checkout (must still work)

- [ ] `POST /cart/checkout` with `paymentMethod: "COD"`, `expectedTotal`, `addressId` (signed-in)  
- [ ] Response order: `paymentMethod` COD, usable `id` / `orderNumber`  
- [ ] `GET /orders` lists that order; `GET /orders/:id` detail OK  
- [ ] Wrong `expectedTotal` → 409 price-changed message (reload cart)  

### E. PayU checkout (API ready on green when PayU env is set)

- [ ] Signed-in only: checkout with `paymentMethod: "PayU"` → order `paymentStatus: pending` (usually `status: pending`)  
- [ ] Guest + PayU → 401 “Sign in to pay online”  
- [ ] `POST /payments/payu/initiate` `{ "orderId", "client": "app" }` → `payuPayload` (+ optional `checkout_html`)  
- [ ] Open PayU (WebView or system browser) using payload / HTML  
- [ ] After return: `POST /payments/payu/verify` `{ "orderId" }` then `GET /orders/:id` → `paymentStatus: paid` on success  
- [ ] Failed/cancelled PayU: order not treated as paid; user can retry initiate or switch to COD on a **new** cart/order per product rules  
- [ ] If initiate returns 503 “Online payment is not configured” → PayU keys missing on server (backend/ops), not an app bug  

### F. Explicit non-checks (do not fail your QA on these)

- [ ] Homecare booking / Homecare PayU  
- [ ] `POST` Homecare `/api/auth/store-token` from Store Expo  
- [ ] Calling `/service` or `/api/service` (public should 403)  
- [ ] Combo / soft-bundle cart  
- [ ] Blue prod PayU until ops says promoted  

---

## 4. Quick curl smoke (optional)

```bash
BASE=https://apitest.jiotechxpert.com

curl -sS "$BASE/health" | head -c 200; echo

# after you have TOKEN from verify-otp:
curl -sS -H "Authorization: Bearer $TOKEN" "$BASE/auth/me"
curl -sS -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"expectedTotal":<cartTotal>,"addressId":<id>,"paymentMethod":"COD"}' \
  "$BASE/cart/checkout"
```

PayU: same checkout with `"PayU"`, then:

```bash
curl -sS -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"orderId":<id>,"client":"app"}' \
  "$BASE/payments/payu/initiate"
```

---

## 5. When something fails

| Symptom | Likely owner |
|---|---|
| Docs missing after pull | Docs branch not merged / wrong branch — ask for docs PR |
| Health degraded / 502 | Ops / green Node |
| OTP never arrives | SMS config on server; local/dev may use documented test OTP |
| PayU 503 not configured | Store green `.env` `PAYU_*` — backend/ops |
| PayU hash / paid never sticks | Backend settlement / PayU surl-furl — not Expo |
| 401 after resume | App must clear session and re-login; token expired or bad storage |

---

## 6. Done for app team (this slice)

You can mark the **API integration slice** done when:

1. COD path works end-to-end on green from the app.  
2. PayU path works end-to-end on green when merchant test keys are live (sections E).  
3. Session hydrate + 401 clear behave correctly.  
4. You did **not** depend on Homecare APIs for Store materials checkout.
