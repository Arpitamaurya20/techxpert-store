# App guide — Store JWT + guest cart SessionID

**Audience:** Store Expo / app engineers maintaining sign-in and cart.  
**Hosts:** map green-slice auth/cart/checkout to GREEN (`apitest.jiotechxpert.com`); browse may stay BLUE — see [`APP_TEAM_PULL_BRIEF.md`](./APP_TEAM_PULL_BRIEF.md).  
**Reference code in repo:** `app/src/state/sessionStore.ts`, `app/src/state/cartSession.ts`, `app/src/services/apiClient.ts`, `app/src/services/cartApi.ts`, `server/src/services/cartService.ts`.

---

## 1. Two different “session” concepts — do not mix them

| | **Store JWT** (login) | **Cart SessionID** (guest bag) |
|---|---|---|
| Purpose | Prove who the customer is | Remember this device’s guest cart |
| Issued by | `POST /auth/verify-otp` → `{ token, user }` | Server creates on first guest cart; returned as `sessionId` |
| Sent as | `Authorization: Bearer <token>` | `x-session-id: <hex>` (header preferred) |
| Stored in DB | Not as a row; JWT is signed with Store `JWT_SECRET` | `carts.SessionID` (and wishlist guest key) |
| App storage | **SecureStore** key `techxpert.session` (native) | **AsyncStorage** key `techxpert.cartSession` |
| Lifetime | ~30 days (API) | Until cart is `ordered`, merged, or discarded |
| Host scope | Token from GREEN only works on GREEN | SessionID only matches carts on that same API host |

There is **no** HttpOnly cookie for Store Expo customer auth. If the Bearer is missing, the API treats the caller as a guest (cart by SessionID) or returns 401 on protected routes.

---

## 2. End-to-end flows

### A. Guest browse → add to cart (no login yet)

```text
App                          Store API                         DB (carts)
 |  GET/PUT /cart  (no Bearer)     |                              |
 |  (+ x-session-id if we have one)|                              |
 | ------------------------------->|  activeCart(sessionId?)      |
 |                                 |  if unknown/missing →        |
 |                                 |    newSessionId() = 64-hex   |
 |                                 |    INSERT Status=active      |
 |  { data: { id, sessionId, … }}  |                              |
 | <-------------------------------|                              |
 |  saveCartSessionId(sessionId)   |                              |
 |  later calls: x-session-id      |                              |
```

Rules:

- App **must not invent** SessionID. Only save what the API returned.
- Validate shape if you re-send: server accepts roughly `[A-Za-z0-9_-]{32,128}` (`isUsableSessionId`).
- While **signed in**, do **not** send `x-session-id` on cart calls (account cart is keyed by `UserID`).

### B. OTP login → JWT

```text
POST /auth/send-otp   { phone }           → 200 (SMS) or 503 if Store SMS env missing
POST /auth/verify-otp { phone, otp, … }   → { token, user }   ← top-level, not under data
```

Do **not** call `POST /auth/login` on green/prod (403).

## Mandatory sequence after OTP (app)

1. Persist guest SessionID before login (from prior cart responses). **Do not rotate it.**
2. `POST /auth/verify-otp` → `{ token, user }`
3. Persist JWT (`setSession`)
4. **Await** `POST /cart/merge` `{ "sessionId": "<same guest id>" }` + `Authorization: Bearer <token>`
5. Only then: `GET /cart`, home badge, checkout navigation

Never: `verify-otp` → navigate → fire merge and `GET /cart` in parallel.

Optional after **successful** merge: clear guest SessionID from device storage. Keep it on merge **401/5xx** so retry can still find the guest bag.

## Chaos triage (login / cart)

| Mode | Symptom | Likely cause | Client action |
|---|---|---|---|
| A | Signed in, empty cart; guest lines still under old SessionID | Merge never called | Await merge before cart UI |
| B | Merge 200 but lines gone | SessionID rotated at login | Never regenerate SessionID on OTP |
| C | Flaky empty then full | Race: GET /cart before merge done | Block UI on merge |
| D | Double merge / toast twice | Remount / retry | Idempotent server + debounce UI |
| E | 401 on merge | Dead/missing Bearer | Clear JWT only; **keep** SessionID; re-auth |
| F | Merge 5xx / FK | `fk_cart_user` still present | Ops: `drop_cart_user_fk.sql`; app shows retry |
| G | “Why send sessionId if we have JWT?” | Mental model | Doc: JWT ≠ guest bag |

### C. App launch (hydrate)

```text
hydrateSession()
  → read SecureStore techxpert.session
  → if token present: set in-memory session
  → GET /auth/me with Bearer
       success → refresh user profile in store
       401 / failure → clearSession()  (dead token; UI signed out)
```

Call hydrate **once** at root before auth-gated screens (`app/_layout.tsx` pattern).

### D. 401 while using the app

On **401**, clear the JWT session locally and force sign-in again.  
Do **not** clear on every **403** (permission / business refuse can still mean a valid login).

Reference behaviour:

```100:104:app/src/services/apiClient.ts
  if (response.status === 401 || response.status === 403) {
    if (response.status === 401) clearSession();
    throw new ApiError('UNAUTHORIZED', 'Please sign in again to continue.', response.status);
  }
```

### E. Checkout

- Prefer signed-in JWT for PayU (guest PayU is refused).  
- COD can be guest (shipping + guestName/guestPhone) or signed-in (`addressId`).  
- Send cart ownership correctly: Bearer **or** `x-session-id`, not a mismatched pair.  
- After success, that cart row becomes `Status = ordered` in DB; next shop needs a new active cart (server creates on next GET/PUT).

---

## 3. Host rules (green + blue)

| Token / key | Valid on |
|---|---|
| JWT from `apitest…/auth/verify-otp` | **Only** `apitest.jiotechxpert.com` (green-slice cart/checkout/orders/me) |
| JWT from `store.jiotechxpert.com` | **Only** blue Store |
| Cart SessionID from green | **Only** green `carts` rows |
| Cart SessionID from blue | **Only** blue |

Common bug: verify-otp against GREEN, then call BLUE `/auth/me` or `/cart` with that Bearer → 401 → app clears JWT and looks like “token not maintained”.

Use the dual-host map: green JWT + green SessionID for green-slice paths only.

---

## 4. Where to store what (platform checklist)

| Data | Native (iOS/Android) | Expo web (`localhost:8081`) |
|---|---|---|
| JWT + user | `expo-secure-store` (`techxpert.session`) | **Current `app/` code does not persist** — `canUseSecureStore()` is false on web, so token is **memory-only** and is lost on full page reload |
| Guest SessionID | AsyncStorage `techxpert.cartSession` | AsyncStorage / localStorage equivalent — OK for guest bag |

If you are debugging “JWT disappears” on **Expo web**, that is expected with the current SecureStore gate unless you add a web persistence path (e.g. `sessionStorage` / secure cookie strategy). Native builds should keep SecureStore.

Never put the JWT in AsyncStorage on native.

---

## 5. Headers cheat sheet

| Situation | Headers |
|---|---|
| Public OTP | `Content-Type: application/json` |
| Signed-in API | `Authorization: Bearer <jwt>` (+ JSON when body) |
| Guest cart | `x-session-id: <server hex>` (+ JSON when body) |
| Signed-in cart | Bearer only — **omit** `x-session-id` |
| After login merge | Bearer + body `{ "sessionId": "<guest hex>" }` |
| Optional checkout | `Idempotency-Key: <opaque>` (CORS allowlist must include it on the API) |

---

## 6. DB picture (what you see in phpMyAdmin)

`carts` table (Store DB, e.g. `techxpertstore_green`):

| Column | Meaning |
|---|---|
| `ID` | Cart id (send as `cartId` at checkout when you have it) |
| `UserID` | Set for account carts; `NULL` for pure guest |
| `SessionID` | Guest key (long hex); often `NULL` on pure user carts |
| `Status` | `active` = open bag; `ordered` = already checked out |

Wishlist uses the same guest SessionID idea (`saved_items.SessionID`) separately from auth.

---

## 7. App implementation checklist

- [ ] Persist JWT+user in SecureStore on native after `verify-otp`  
- [ ] `hydrateSession()` on launch; `/auth/me` to validate; clear on failure  
- [ ] All API helpers attach Bearer from one source of truth (`getAuthToken()`)  
- [ ] Clear JWT only on **401** (and explicit logout), not on every 403  
- [ ] Persist guest SessionID from cart responses; send as `x-session-id` when logged out  
- [ ] After login: `POST /cart/merge` with that SessionID once  
- [ ] Do not send green JWT to blue (or blue JWT to green)  
- [ ] Expo web: decide persistence if reload must keep login (current repo: memory-only)  
- [ ] PayU / COD green-slice: same host as the JWT and cart  

---

## 8. Failure modes → cause

| Symptom | Likely cause |
|---|---|
| Signed in, refresh, signed out (web) | No SecureStore on web — token never persisted |
| Signed in, next call 401, then signed out | Wrong host for JWT; expired token; hydrate `/auth/me` failed |
| Guest cart empty after restart | SessionID not saved / not sent as `x-session-id` |
| Guest lines missing after login | Skipped `POST /cart/merge` or wrong `sessionId` |
| Checkout 403 cart | Bearer user ≠ cart UserID, or SessionID ≠ cart.SessionID |
| “CORS” on checkout only | API missing `Idempotency-Key` in CORS allowlist (platform), or Origin not allowed |

---

## 9. Related docs

- Route + auth labels: [`STORE_CUSTOMER_API.md`](./STORE_CUSTOMER_API.md)  
- Host map green/blue: [`APP_TEAM_PULL_BRIEF.md`](./APP_TEAM_PULL_BRIEF.md)  
- OTP / PayU platform gates: [`GREEN_DEPLOY_MANIFEST.md`](./GREEN_DEPLOY_MANIFEST.md) §GATE  
- Request examples: [`APP_API_GUIDE.md`](./APP_API_GUIDE.md) UC-7 (OTP), cart/checkout use cases  
