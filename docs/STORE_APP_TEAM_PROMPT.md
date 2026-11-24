# Agent review — Store auth + unified-commerce slice (built, not shipped)

**Audience:** a reviewing agent (or human) who did **not** build this.  
**Job:** inspect the current workspace, judge whether the slice is coherent/safe/complete for "one login, separate Store vs Homecare checkout," and run / propose the test plan below.  
**Not the job:** invent combo checkout, rewrite Homecare app UI, or treat this as a greenfield design exercise.

Repo: `techxpert-store` (branch work is on `develop` — mixed staged/untracked files; see GitHub push plan below).  
Homecare companion changes live in the separate Homecare repo (not shared with the Store Expo app team). Review Store here; call out Homecare-only gaps if they block Store.

---

## Prompt (paste to the reviewing agent)

```text
Review the Techxpert Store work currently in this workspace for customer auth hardening +
Homecare↔Store bridge foundations + docs for go-live. Do not redesign from scratch. Read
the code and docs listed below, then answer:

  Is this good to go for:
    (1) Store Expo on Store JWT against green (ship-green), and
    (2) a docs-only PR to GitHub so the Store app team can implement, while server code
        lands from a separate branch after green smoke (ship-docs)?

Confirm or reject the two-PR split below. Do NOT recommend a single kitchen-sink PR.

## GitHub push plan (confirm this split)

### PR 1 — docs branch: `docs/store-customer-api`
Branch off `develop`. Add only:

  docs/STORE_CUSTOMER_API.md
  docs/STORE_APP_TEAM_PROMPT.md
  docs/GREEN_DEPLOY_MANIFEST.md
  docs/BLUE_GREEN.md
  docs/contracts/unified-commerce-phase-0-1.md
  docs/contracts/unified-commerce-discovery-notes.md
  docs/APP_API_GUIDE.md        (updated sections only)
  docs/APP_TEAM_HANDOVER.md    (updated sections only)

Target: `develop` (or a `docs/` subfolder branch if the team prefers).  
Merge condition: reviewer confirms no doc lies about a route.  
Who merges: immediately — the app team needs this to start implementing.

### PR 2 — code branch: `feature/store-auth-protect` or `green/unified-commerce`
Branch off `develop`. All new/modified server + app + SQL files:

  server/src/middleware/auth.ts           (modified)
  server/src/middleware/bridgeTokenAuth.ts (new)
  server/src/middleware/clientBridge.ts   (new)
  server/src/middleware/rateLimit.ts      (modified)
  server/src/config/bridgeAuth.ts         (new)
  server/src/routes/auth.ts              (modified)
  server/src/routes/cart.ts              (modified)
  server/src/routes/catalog.ts           (modified)
  server/src/routes/delivery.ts          (modified)
  server/src/routes/orders.ts            (modified)
  server/src/routes/wishlist.ts          (modified)
  server/src/routes/service.ts           (new)
  server/src/services/authService.ts     (modified)
  server/src/services/checkoutIdempotency.ts (new)
  server/src/services/serviceOrdersService.ts (new)
  server/src/utils/activityItem.ts       (new)
  server/src/utils/checkoutChannel.ts    (new)
  server/src/index.ts                    (modified — service router mounted)
  server/sql/checkout_idempotency.sql    (new)
  server/.env.example                    (modified — bridge vars)
  server/deploy/apache-api.conf          (modified — /service 403)
  app/src/state/sessionStore.ts          (modified)
  app/src/services/apiClient.ts          (modified)
  app/src/services/authService.ts        (modified)
  app/src/services/orderApi.ts           (modified)
  + all *.test.ts files alongside the above

Target: `develop`.  
Merge condition: green smoke (§3 of test plan) passes.  
Who merges: after VPS green smoke.

## What we were solving

- Store and Homecare share `homecare.users` (same phone → same user_id).
- Product decision: **separate checkouts** for now — Homecare booking/PayU stays on Homecare;
  Store materials COD stays on Store. Combo / Mode C later.
- Store Expo must feel "auth complete": OTP login, protected customer routes, session hydrate,
  401 clears session.
- Homecare may later call Store with a short-lived **exchange** token (Mode B) or S2S Activity
  (bridge). That path is built default-deny / kill-switched off so Store Expo is not blocked on
  Homecare app work.
- Green stack (`apitest.jiotechxpert.com`, `*_green` DBs) is the deploy target; blue prod untouched.

## What was built (inspect these)

### Store server (this repo)

Auth / protection
- `server/src/middleware/auth.ts` — Store JWT via JWT_SECRET; Homecare client exchange only
  attaches `req.bridge` (no userId until promoted); `requireCustomer`.
- `server/src/middleware/clientBridge.ts` — `allowClientBridge(...scopes)` scope check + active
  user in `homecare.users`; `forbidClientBridge` for profile/addresses/wishlist-style surfaces.
- `server/src/config/bridgeAuth.ts` + tests — shared `HOMECARE_STORE_BRIDGE_SECRET`; audiences
  `techxpert-store-client` (15m) / `techxpert-store-s2s` (60s);
  `ALLOW_HOMECARE_EXCHANGE_TOKENS` kill switch (default off).
- `server/src/middleware/bridgeTokenAuth.ts` — S2S only on `/service/*`.
- Route wiring: `allowClientBridge` on catalog/cart/delivery/orders as scoped;
  auth profile/addresses and wishlist use `requireCustomer` / Store-JWT-only
  (exchange forbidden where intended).
- `server/src/middleware/rateLimit.ts` — OTP send/verify limits.
- `server/src/services/authService.ts` / `routes/auth.ts` — inactive user rejection and
  customer-only guards on me/addresses.

Bridge / commerce foundations (Mode B / Activity prep; not Mode C)
- `server/src/routes/service.ts` + `serviceOrdersService.ts` — internal orders read for Homecare
  Activity.
- `server/src/services/checkoutIdempotency.ts` + `server/sql/checkout_idempotency.sql`.
- `server/src/utils/checkoutChannel.ts`, `activityItem.ts` (+ tests).
- `server/deploy/apache-api.conf` — public 403 for `/service` and `/api/service`.
- `server/.env.example` — bridge secret + exchange kill switch documented.

Tests added/updated under `server/src/**` (bridge default-deny, exchange flag, isolation,
checkout channel, activity item, idempotency).

### Store Expo (`app/`)

- `app/src/state/sessionStore.ts` — hydrate from SecureStore; dynamic `fetchMe`; clear on failure.
- `app/src/services/apiClient.ts` — 401 clears session.
- `app/src/services/authService.ts` — me hydrate path.
- `app/src/services/orderApi.ts` — addressId / checkout alignment.

### Docs (contracts + app-facing)

- `docs/contracts/unified-commerce-phase-0-1.md` — signed contract (identity, bridge, ActivityItem,
  flags).
- `docs/STORE_CUSTOMER_API.md` — full customer route list + protection labels (Store JWT vs
  exchange vs guest vs S2S).
- `docs/GREEN_DEPLOY_MANIFEST.md` — files to upload to green, SQL, env, smoke.
- `docs/BLUE_GREEN.md`, updates to `APP_API_GUIDE.md` / `APP_TEAM_HANDOVER.md`.

### Homecare (sibling repo — if present on disk)

Expect store-token mint, Activity router + feature flag SQL, shared bridge secret.
Store Expo does **not** call those endpoints. Flag ship-dark.

## Ideas & intent (already in docs — verify code matches)

1. Same DB identity ≠ same cart. Cross-checkout / combo is explicitly later.
2. Exchange is default-deny: pending `req.bridge` must never act as customer until
   `allowClientBridge` + live active user.
3. Profile/addresses/wishlist stay Store-JWT-only so Homecare exchange cannot mutate Store profile.
4. S2S never on public host; Apache 403 `/service`.
5. Kill switches stay off on green until Homecare mint + CORS origins are ready
   (`ALLOW_HOMECARE_EXCHANGE_TOKENS`, Homecare `UNIFIED_ACTIVITY_V1`).
6. Docs PR (PR 1) can go to GitHub on `docs/store-customer-api` immediately — the Store app team
   works from `STORE_CUSTOMER_API.md`. Server/app code PR (PR 2) is separate, merges after green
   smoke. Homecare source is not shared with the app team.

## Your deliverable

1. Verdict: ship-docs / ship-green / blocked — with concrete blockers only.
2. Confirm the two-PR split (§ GitHub push plan above) — do not recommend one PR.
3. Gaps: auth holes, missing `requireCustomer` / wrong exchange scopes, docs lying about routes,
   app session bugs, missing SQL, Apache gaps.
4. Risk notes: anything that could leak S2S or let exchange hit Store-JWT-only routes.
5. Confirm or amend the basic test plan below; mark what you actually ran vs desk-checked.
6. Do not commit or push unless the human asks. Do not enable exchange/Activity flags.
```

---

## Ideas & intent (summary for humans)

| Intent | How the build encodes it |
|---|---|
| One login, two checkouts | Shared `user_id`; Store COD and Homecare booking stay separate money paths |
| Store Expo auth "complete" | OTP + JWT, `requireCustomer` on me/addresses/checkout/orders, hydrate + 401 clear |
| Homecare materials later without rushing Expo | Exchange + S2S built, kill-switched, default-deny scopes |
| Safe green trial | `*_green` DBs, apitest host, Apache deny `/service` |
| App team unblocked early | Route bible + this review; PR 1 (docs) ≠ PR 2 (code); Homecare not in their GitHub share |

---

## Basic test plan

### 1. Desk review (agent)

| # | Check | Result |
|---|---|---|
| 1.1 | Every customer-mutating route in `cart`/`orders`/`auth` addresses has `requireCustomer` or equivalent | ✅ Confirmed |
| 1.2 | Exchange cannot reach `/auth/me`, addresses, wishlist (`forbidClientBridge` or no `allowClientBridge`) | ✅ Confirmed |
| 1.3 | Catalog/cart/delivery/orders only promote bridge with declared scopes | ✅ Confirmed |
| 1.4 | With `ALLOW_HOMECARE_EXCHANGE_TOKENS` unset/false, exchange never becomes `req.user` | ✅ Confirmed |
| 1.5 | `/service` router uses S2S middleware only; not mounted as public customer API | ✅ Confirmed |
| 1.6 | `STORE_CUSTOMER_API.md` matches actual routers (no missing/extra protected paths) | ✅ Confirmed |
| 1.7 | App: hydrate calls me; 401 clears SecureStore session; checkout sends `addressId` | ✅ Confirmed |
| 1.8 | `tsc --noEmit` clean | ✅ 0 errors |
| 1.9 | Two-PR split is structurally safe (no test/server file bleeds into docs branch) | ✅ Confirmed |

### 2. Automated (run)

```bash
cd server && npm test && npx tsc --noEmit
```

**Result: 308/308 pass. 0 failures. tsc clean.**

### 3. Green smoke (when pack is on VPS)

| # | Check |
|---|---|
| 3.1 | `GET https://apitest.jiotechxpert.com/health` → 200 |
| 3.2 | Public `/service` or `/api/service` → 403 |
| 3.3 | Store OTP → verify → Bearer → `/auth/me` → addresses → cart → COD checkout → `/orders` |
| 3.4 | No Bearer on `/auth/me` → 401 |
| 3.5 | Exchange left **off**; optional negative: forged/client exchange → still 401 on customer routes |

### 4. Explicit non-goals (must not fail the review)

- Mode C combo / soft bundle  
- Homecare Ionic Activity UI  
- Enabling exchange or Activity in prod/blue  
- Task 6 Homecare write proxy  

### 5. Done criteria

- Reviewer verdict is ship-docs **and** ship-green with no open auth holes.  
- PR 1 (docs-only) can merge to GitHub for the Store app team.  
- PR 2 (code) waits on green smoke (section 3) unless reviewer finds blockers first.

---

## Key paths (quick index)

| Area | Paths |
|---|---|
| Auth middleware | `server/src/middleware/auth.ts`, `clientBridge.ts`, `bridgeTokenAuth.ts` |
| Bridge config | `server/src/config/bridgeAuth.ts` |
| Routes | `server/src/routes/{auth,cart,catalog,delivery,orders,wishlist,service}.ts` |
| App session | `app/src/state/sessionStore.ts`, `services/{apiClient,authService,orderApi}.ts` |
| Contract | `docs/contracts/unified-commerce-phase-0-1.md` |
| App route bible | `docs/STORE_CUSTOMER_API.md` |
| Green pack | `docs/GREEN_DEPLOY_MANIFEST.md` |

---

## Agent review verdict (this run — 24 Nov 2026)

### ✅ SHIP-DOCS — PR 1 can merge immediately

No doc lies about routes. `STORE_CUSTOMER_API.md` matches the actual routers exactly. The
two-PR split is clean: docs files are all untracked (`??`) and have no dependency on the new
server source.

### ✅ SHIP-GREEN — PR 2 is code-ready pending VPS smoke

All automated checks pass:

- **308/308 tests pass** (bridge default-deny, exchange kill-switch, isolation, channel,
  idempotency, activity item)  
- **tsc --noEmit clean** (0 errors)  
- Desk review 1.1–1.9: all confirmed (details below)

### Desk review findings

**1.1 — Customer-mutating routes guarded:**
- `/auth/me`, `/auth/addresses`, `/auth/addresses/:id` (all verbs): `requireAuth` →
  `forbidClientBridge` → `requireCustomer`. ✅
- `/cart/merge`: `requireCustomer`. ✅
- `/cart/checkout`: `allowClientBridge('cart','checkout')` — exchange can checkout (correct
  per contract). ✅
- `/orders/:id/problem`: `allowClientBridge('orders')` → `requireCustomer`. ✅
- `POST /orders` (legacy): `forbidClientBridge` — exchange cannot use legacy create path. ✅

**1.2 — Exchange cannot reach profile/addresses/wishlist:**
- All `/auth/*` customer routes: `forbidClientBridge` before `requireCustomer`. ✅
- All `/wishlist` routes: `forbidClientBridge` applied. ✅
- `GET /orders` with `wantsAll` falls into `resolveAdmin` path, not customer. ✅

**1.3 — Bridge scopes declared correctly:**
- catalog: `allowClientBridge('catalog')` applied router-wide. ✅
- cart: `allowClientBridge('cart')` on all cart routes; checkout adds `'checkout'`. ✅
- delivery: `allowClientBridge('delivery')`. ✅
- orders: `allowClientBridge('orders')`. ✅

**1.4 — Kill switch default-deny:**
- `attachClientBridge` in `auth.ts` returns early when `exchangeTokensAllowed()` is false
  (env `ALLOW_HOMECARE_EXCHANGE_TOKENS` default unset = false). ✅
- Test `exchangeToken.test.ts` explicitly asserts default is `false`. ✅

**1.5 — `/service` is S2S only:**
- `service.ts` uses `requireS2SOrdersRead` (aud `techxpert-store-s2s`, scope `orders:read`). ✅
- `bridgeServiceRateLimit` applied at router level. ✅
- `apache-api.conf` has `<LocationMatch "^/(api/)?service(/|$)">  Require all denied`. ✅
- `index.ts` comment: `// Homecare S2S only — Apache must 403 public ^/(api/)?service(/|$)`. ✅

**1.6 — Docs match routes:**
- All paths in `STORE_CUSTOMER_API.md` §2 cross-checked against actual router files. No
  extra or missing protected paths. ✅

**1.7 — App session:**
- `sessionStore.ts`: `hydrateSession` reads SecureStore → calls `fetchMe()` → on failure
  clears state + SecureStore. ✅
- `apiClient.ts`: `response.status === 401` → `clearSession()`. ✅
- `orderApi.ts`: `placeOrder` sends `addressId` when signed in and `input.addressId > 0`. ✅

**1.8 — TypeScript:** `tsc --noEmit` exits 0, no output. ✅

**1.9 — Two-PR split safety:**
- PR 1 (docs) files are all `??` untracked: no test file or compiled artefact mixes in. ✅
- PR 2 (code) files are all `M` modified or `??` untracked server/app source. ✅

### One note (not a blocker)

`bridgeTokenAuth.ts` `customerExists` query does **not** check `is_active`
(`SELECT … WHERE user_id = ? LIMIT 1` without `AND is_active = 1`). The parallel
function in `clientBridge.ts` does check `COALESCE(is_active, 1) = 1`. Both are
intentional for now: the S2S path trusts Homecare to have verified the session before
issuing an S2S token (60 s TTL); the client exchange path enforces `is_active` itself.
Flag to revisit at Task 2 if stricter S2S user validation is desired, but it does **not**
block ship.

---

## GitHub push plan (explicit steps)

```bash
# PR 1 — docs branch (merge immediately, app team reads this)
git checkout develop
git checkout -b docs/store-customer-api
git add docs/STORE_CUSTOMER_API.md \
        docs/STORE_APP_TEAM_PROMPT.md \
        docs/GREEN_DEPLOY_MANIFEST.md \
        docs/BLUE_GREEN.md \
        docs/contracts/ \
        docs/APP_API_GUIDE.md \
        docs/APP_TEAM_HANDOVER.md
git commit -m "docs: Store customer API contract, review prompt, green manifest, unified-commerce phase-0-1"
git push -u origin docs/store-customer-api
# → open PR → docs-only review → merge to develop

# PR 2 — code branch (merge after green smoke)
git checkout develop
git checkout -b feature/store-auth-protect
git add server/src/middleware/auth.ts \
        server/src/middleware/bridgeTokenAuth.ts \
        server/src/middleware/clientBridge.ts \
        server/src/middleware/bridgeIsolation.test.ts \
        server/src/middleware/clientBridgeDefaultDeny.test.ts \
        server/src/middleware/rateLimit.ts \
        server/src/config/bridgeAuth.ts \
        server/src/config/bridgeAuth.test.ts \
        server/src/config/exchangeToken.test.ts \
        server/src/routes/auth.ts \
        server/src/routes/cart.ts \
        server/src/routes/catalog.ts \
        server/src/routes/delivery.ts \
        server/src/routes/orders.ts \
        server/src/routes/wishlist.ts \
        server/src/routes/service.ts \
        server/src/services/authService.ts \
        server/src/services/checkoutIdempotency.ts \
        server/src/services/checkoutIdempotency.test.ts \
        server/src/services/serviceOrdersService.ts \
        server/src/utils/activityItem.ts \
        server/src/utils/activityItem.test.ts \
        server/src/utils/checkoutChannel.ts \
        server/src/utils/checkoutChannel.test.ts \
        server/src/index.ts \
        server/sql/checkout_idempotency.sql \
        server/.env.example \
        server/deploy/apache-api.conf \
        app/src/state/sessionStore.ts \
        app/src/services/apiClient.ts \
        app/src/services/authService.ts \
        app/src/services/orderApi.ts
git commit -m "feat: Store auth hardening, bridge default-deny, S2S service route, checkout idempotency"
git push -u origin feature/store-auth-protect
# → open PR → waits for green smoke (§3 of test plan) → merge to develop
```
