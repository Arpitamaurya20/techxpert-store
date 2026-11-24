# App team — pull brief + verification checklist

**Audience:** Store Expo / app engineers who just pulled (or will pull) the Store docs + build against green.  
**Pasteable “prompt”:** §1 — give this to anyone (or another agent) so they know what landed and what to verify.  
**Your job:** wire the Expo app to these APIs. **Not your job:** Homecare backend source, VPS uploads, Mode C combo.

| Env | Base URL |
|---|---|
| **Green (use this for new auth + PayU)** | `https://apitest.jiotechxpert.com` (paths work with or without `/api`) |
| Blue / prod (COD already live; PayU after promote) | `https://store.jiotechxpert.com` |

**Read after pull (in order):**

1. This file (checklist)  
2. [`STORE_CUSTOMER_API.md`](./STORE_CUSTOMER_API.md) — full route + auth labels  
3. [`APP_API_GUIDE.md`](./APP_API_GUIDE.md) — UC-10 COD + **UC-10b PayU**  
4. [`APP_TEAM_HANDOVER.md`](./APP_TEAM_HANDOVER.md) — Expo folder map / COD baseline  

If a linked file is missing on your branch, ask for the docs PR / `docs/store-customer-api` or green Store docs commit — do not invent routes.

---

## 1. Prompt (paste to a teammate or agent)

```text
You are helping the Store Expo app team after a Git pull of Techxpert Store docs / contract updates.

CONTEXT
- One shared customer identity with Homecare (`homecare.users` / same phone → same user_id).
- Separate checkouts: Store owns materials (COD and PayU on the Store API). Homecare owns service bookings on the Homecare API. No combo cart.
- Point the app at GREEN for this work: EXPO_PUBLIC_API_BASE_URL=https://apitest.jiotechxpert.com/api
- Auth for Store Expo = Store OTP → 30-day Store JWT (Bearer). Do NOT call Homecare /api/auth/store-token from Store Expo (that is Homecare app Mode B later).
- PayU is order-first: POST /cart/checkout with paymentMethod "PayU" → POST /payments/payu/initiate → open PayU with payuPayload or checkout_html → on return POST /payments/payu/verify → GET /orders/:id. COD still works with paymentMethod "COD".
- Backend/API owners ship APIs + docs only; you wire Expo (session, WebView/browser for PayU, screens).

AFTER PULL
1. Read docs/APP_TEAM_PULL_BRIEF.md and tick every checkbox you can verify from the device or curl.
2. Follow docs/STORE_CUSTOMER_API.md for auth labels (Customer vs Guest+ vs public).
3. Implement against green; do not block on blue PayU until ops promotes.

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

Use green: `https://apitest.jiotechxpert.com`. Prefer a real device / Expo build with `EXPO_PUBLIC_API_BASE_URL=…/api`.

### A. Pull & docs

- [ ] Pulled the branch/PR that contains `docs/STORE_CUSTOMER_API.md` and APP_API_GUIDE UC-10b  
- [ ] Read §1 prompt + this checklist  
- [ ] App `.env` / `.env.local` points at **apitest**, not only prod  

### B. Health & auth

- [ ] `GET /health` → 200, both DBs ok (or ask backend if degraded)  
- [ ] `POST /auth/send-otp` `{ "phone": "<10-digit>" }` → success  
- [ ] `POST /auth/verify-otp` `{ "phone", "otp" }` → top-level `{ token, user }`  
- [ ] `GET /auth/me` with `Authorization: Bearer <token>` → 200  
- [ ] `GET /auth/me` without token → 401  
- [ ] App: after 401, SecureStore session cleared and UI shows signed-out  

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

### Expo screens wired (this repo)

| Screen | Path | Notes |
|---|---|---|
| Sign in | `app/src/app/login.tsx` + `LoginForm` | AuthHero + OTP send; guest continue |
| OTP | `app/src/app/otp-login.tsx` | Verify → SecureStore session |
| Checkout payment | `app/src/app/checkout.tsx` | COD or PayU (PayU requires sign-in) |
| PayU WebView | `app/src/app/payu-checkout.tsx` | initiate → WebView/browser → verify |
| Success | `app/src/app/order-placed.tsx` | COD or paid online copy |
