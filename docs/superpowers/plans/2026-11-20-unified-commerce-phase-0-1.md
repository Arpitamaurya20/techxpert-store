# Unified Commerce Phase 0+1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align Homecare and Store so customers share one identity-backed Activity feed and can buy Store materials from the Homecare app using Store’s existing commerce rules — without Mode C soft/hard bundle, without SSO rewrite, and without regressing the Store Expo app.

**Architecture:** Phase 0–1 use a **Homecare-side compose/proxy adapter** that calls Store domain APIs with scoped service credentials. Domain money/stock/booking rules stay in their owners. The full Commerce Orchestrator + `techxpert_orch` schema is **deferred to Phase 2** (see design spec). Store Expo app continues to call Store API directly for Mode B.

**Tech Stack:** Homecare Node/Express (JS) + MySQL `homecare`; Store Node/Express (TS) + MySQL `techxpertstore`/`homecare`; Homecare Ionic app; Store Expo app (regression only).

**Design source of truth:** [`../specs/2026-11-20-unified-commerce-design.md`](../specs/2026-11-20-unified-commerce-design.md)

## Global Constraints

- Never reimplement Store pricing, bulk tiers, pack size, stock, or COD rules inside Homecare.
- Never reimplement Homecare booking fee, visit, slot, wallet, or PayU rules inside Store.
- Do not change `homecare` schema from the Store repo; Homecare-owned migrations only in `Homecare/backend`.
- Do not invent stock reservation or single PayU Mode C in this plan (Phase 3 / Phase 2 respectively).
- Store Expo Mode B (`POST /cart/checkout`, `channel=store_app` default) must keep working; add regression checks every Store task.
- Soft bundle / hard bundle / `TX-GRP-*` checkout groups are **out of scope** for Phase 0–1.
- Prefer thin proxies and composed reads over a third cart source of truth.
- All money values remain server-computed; clients display only.
- Commits only when the human asks; work on `develop` in Store; follow Homecare’s existing branch practice.
- Feature-flag every new Homecare customer-facing surface.

---

## File map (what will exist after Phase 0–1)

### Store (`~/Desktop/techxpert-store`)

| Path | Responsibility |
|---|---|
| `docs/superpowers/specs/2026-11-20-unified-commerce-design.md` | Locked architecture (already written) |
| `docs/contracts/unified-commerce-phase-0-1.md` | Shared contracts: identity, service auth, activity item shape, materials proxy rules |
| `server/src/middleware/serviceAuth.ts` | Verify scoped service credentials + act-as `userId` |
| `server/src/config/serviceClients.ts` | Allowed service client ids / secrets / scopes from env |
| `server/src/middleware/auth.ts` | Wire optional service auth alongside customer JWT |
| `server/src/routes/orders.ts` | Allow service+act-as for `GET /orders` (customer-scoped) |
| `server/src/routes/cart.ts` | Allow service+act-as for cart + checkout |
| `server/src/routes/catalog.ts` | Public reads unchanged; document for Homecare proxy |
| `server/src/utils/orderChannel.ts` | Keep `homecare_app` / `store_app` |
| `server/src/utils/serviceAuth.test.ts` | Unit tests for service auth |
| `server/.env.example` | `SERVICE_CLIENTS_JSON` (or equivalent) documented |
| `docs/APP_API_GUIDE.md` | Document service-auth headers + Homecare channel usage |

### Homecare (`~/Desktop/Homecare`)

| Path | Responsibility |
|---|---|
| `backend/src/config/storeClient.js` | Store base URL + service credentials |
| `backend/src/services/storeApiClient.js` | HTTP client: catalog, cart, checkout, orders (no pricing logic) |
| `backend/src/routes/activity.js` | `GET /api/activity` composed feed |
| `backend/src/routes/storeBridge.js` | Feature-flagged materials bridge: catalog/cart/checkout proxy |
| `backend/src/app.js` | Mount `/api/activity`, `/api/store/*` |
| `backend/tests/activity.test.js` | Compose + auth tests |
| `backend/tests/storeBridge.test.js` | Proxy passthrough + channel injection tests |
| Homecare customer app (separate app repo if not in this tree) | Feature-flagged Store tab + Activity screen using new APIs |

### Deferred (Phase 2+)

- New Orchestrator package / deployable
- `techxpert_orch` schema (`checkout_groups`, legs, events, idempotency, payment_allocations)
- Soft-bundle unified checkout endpoints
- Service↔SKU mapping tables + portal UI

---

## As-built anchors (discovery already done)

Use these; do not invent parallel endpoints.

**Store (port 5001, also `/api` prefix):**
- Auth: `POST /auth/send-otp`, `POST /auth/verify-otp`, `GET /auth/me`, `GET /auth/addresses` — `server/src/routes/auth.ts`
- Cart: `GET /cart`, `PUT /cart/items/:productId`, `POST /cart/merge`, `POST /cart/checkout` — `server/src/routes/cart.ts`
- Checkout body already accepts `channel: store_app | homecare_app` — `cartCheckoutService.ts` + `order_channel.sql`
- Orders: `GET /orders`, `GET /orders/:id` — `server/src/routes/orders.ts`
- Customer JWT: Bearer, `userId` claim — `server/src/middleware/auth.ts`
- Catalog: `GET /catalog/products?view=card`, `GET /cms/home-boot` — live per `APP_TEAM_HANDOVER.md`
- **No** stock reservation API today (decrement happens inside checkout transaction)
- **No** Idempotency-Key header today; cart checkout replay is via `cartId` + ordered status

**Homecare:**
- Auth: `POST /api/auth/send-otp`, `verify-otp`, `refresh`, `GET /api/auth/me` — `backend/src/routes/auth.js`
- JWT: cookie `access_token` or Bearer — `backend/src/middleware/auth.js`
- Cart (services): `/api/cart/get_cart`, `add_item`, … — `backend/src/routes/cart.js`
- Bookings: `/api/bookings/get_user_bookings`, `get_booking_details`, `hold_slot`, `create_booking` — `backend/src/routes/bookings.js`
- Leads: `GET /api/leads` — `backend/src/routes/leads.js`
- Slot hold endpoints **exist** (`hold_slot`, `release_slot_hold`) — verify behaviour in Phase 3 spike, not here

---

### Task 0: Discovery audit spikes (both repos) — do before coding adapters

**Files:**
- Create: `techxpert-store/docs/contracts/unified-commerce-discovery-notes.md`
- Create: (optional copy) `Homecare/backend/briefs/UNIFIED_COMMERCE_DISCOVERY.md`

**Interfaces:**
- Produces: written answers that Tasks 1–6 depend on (token claim shapes, address field parity, order list shapes)

- [ ] **Step 1: Capture Store customer JWT payload shape**

Run against a local Store API (signed-in test user):

```bash
cd /Users/satwik/Desktop/techxpert-store/server
# After verify-otp, decode the token payload (header.payload.signature) and record:
# - claim names for user id (userId vs id vs sub)
# - expiry
# - whether refresh tokens exist for customers
```

Write findings into `docs/contracts/unified-commerce-discovery-notes.md` under `## Store JWT`.

- [ ] **Step 2: Capture Homecare customer JWT payload shape**

```bash
cd /Users/satwik/Desktop/Homecare/backend
# Decode access_token from verify-otp; record user id claim name and cookie vs Bearer behaviour
```

Write under `## Homecare JWT`. Confirm both refer to the same `homecare.users.user_id` for a known phone.

- [ ] **Step 3: Address field parity check**

Compare one user’s rows:
- Store `GET /auth/addresses` response fields (`flatNo`, `area`, …) — see `APP_API_GUIDE.md` UC-9
- Homecare customer addresses API under `/api/customers` (existing)

Document field mapping table. Note mismatches; **do not migrate schema in Phase 0** — Activity and materials checkout must pick one address source per flow (Homecare address → Store checkout `shippingAddress`/`pincode` or Store `addressId` only if IDs are the same table).

Expected: both read `homecare.user_addresses`; IDs should match. If Store and Homecare already share the table, record that as “same address_id works for Store checkout `addressId`”.

- [ ] **Step 4: Prove Store Mode B + channel tag**

```bash
# Signed-in or guest checkout with channel
curl -sS -X POST "$STORE_API/cart/checkout" \
  -H "Authorization: Bearer $STORE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"expectedTotal":...,"addressId":...,"paymentMethod":"COD","channel":"homecare_app","cartId":...}'
```

Confirm `order_channel` row is `homecare_app`. Record exact request that worked.

- [ ] **Step 5: List Homecare “My bookings / leads” payloads**

Call `GET /api/bookings/get_user_bookings` and `GET /api/leads` with a Homecare token. Paste redacted sample shapes into the discovery notes under `## Activity sources`.

- [ ] **Step 6: Exit criteria for Task 0**

Discovery notes must answer:
1. Same `user_id` across both JWTs for one phone? yes/no + evidence
2. Same `address_id` usable on Store checkout? yes/no
3. Store checkout with `channel=homecare_app` works? yes/no
4. Exact env vars needed for Homecare→Store HTTP calls

Do not start Task 2 until 1–3 are yes (or a written mitigation exists).

---

### Task 1: Shared Phase 0–1 contract document

**Files:**
- Create: `techxpert-store/docs/contracts/unified-commerce-phase-0-1.md`
- Modify: `techxpert-store/docs/ARCHITECTURE.md` — add a short “Unified commerce (Phase 0–1)” pointer to the contract + design spec (10–15 lines max)

**Interfaces:**
- Consumes: Task 0 discovery notes
- Produces: frozen DTO names used by Homecare Activity + Store service auth

- [ ] **Step 1: Write the contract file** with these sections exactly:

1. **Identity** — `customerId` = `homecare.users.user_id`
2. **Service auth headers** (Store internal):
   - `X-Service-Client: <client_id>`
   - `X-Service-Secret: <secret>` (or HMAC alternative if you choose; document one)
   - `X-Act-As-User-Id: <customerId>`
   - Scopes: `orders:read`, `cart:write`, `checkout:write`, `catalog:read` (catalog may stay public)
3. **Activity item DTO** (composed):

```json
{
  "id": "booking:123",
  "kind": "booking | store_order | lead",
  "title": "string",
  "status": "string",
  "amountPaise": 0,
  "createdAt": "ISO-8601",
  "deepLink": "string",
  "channel": "store_app | homecare_app | null",
  "nativeRef": "BK-… or TX-ORD-…"
}
```

4. **Materials proxy rules** — Homecare forwards Store responses; may not alter `totals` / unit prices; must send `channel=homecare_app` on checkout
5. **Feature flags** — `UNIFIED_ACTIVITY_V1`, `HOMECARE_STORE_BRIDGE_V1`
6. **Non-goals** — copy from design spec §7 relevant to Phase 0–1

- [ ] **Step 2: Link from ARCHITECTURE.md**

Add under dual-database section:

```markdown
### Unified commerce (Phase 0–1)
See `docs/superpowers/specs/2026-11-20-unified-commerce-design.md` and
`docs/contracts/unified-commerce-phase-0-1.md`. Homecare may call Store with
service credentials for Activity and materials bridge. Mode C is not in this phase.
```

- [ ] **Step 3: Human review gate**

Stop and get approval of the contract before implementing service auth. If the human asks for changes, edit the contract first.

---

### Task 2: Store service-credential auth (read path)

**Files:**
- Create: `server/src/config/serviceClients.ts`
- Create: `server/src/middleware/serviceAuth.ts`
- Create: `server/src/utils/serviceAuth.test.ts` (or `server/src/middleware/serviceAuth.test.ts` matching repo test layout)
- Modify: `server/src/middleware/auth.ts`
- Modify: `server/.env.example`
- Modify: `server/src/routes/orders.ts` — allow service act-as on list/detail for that user only

**Interfaces:**
- Consumes: contract §Service auth headers
- Produces: `requireCustomerOrService(scope)` middleware setting `req.user.userId`

- [ ] **Step 1: Write failing unit tests for service client parsing + scope check**

```ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseServiceClients, assertScope } from '../config/serviceClients.js';

describe('serviceClients', () => {
  it('parses client scopes from JSON env', () => {
    const clients = parseServiceClients(
      JSON.stringify([{ id: 'homecare', secret: 's', scopes: ['orders:read'] }])
    );
    assert.equal(clients.homecare.secret, 's');
    assert.ok(clients.homecare.scopes.includes('orders:read'));
  });

  it('rejects missing scope', () => {
    assert.throws(() =>
      assertScope({ id: 'homecare', secret: 's', scopes: ['orders:read'] }, 'cart:write')
    );
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL (module missing)**

```bash
cd /Users/satwik/Desktop/techxpert-store/server && npm test -- --test-name-pattern=serviceClients
```

Expected: FAIL cannot find module / tests fail.

- [ ] **Step 3: Implement `serviceClients.ts` + `serviceAuth.ts`**

Minimal behaviour:
- Load clients from `process.env.SERVICE_CLIENTS_JSON`
- Middleware validates client id+secret (timing-safe compare)
- Requires `X-Act-As-User-Id` positive int
- Sets `req.user = { userId }` and `req.serviceClient = { id, scopes }`
- Helper `requireServiceScope('orders:read')`

- [ ] **Step 4: Wire orders routes**

For `GET /orders` and `GET /orders/:id`, accept either customer Bearer **or** valid service auth with `orders:read`. Service path may only read the act-as user’s orders (existing ownership checks must still apply using `req.user.userId`).

- [ ] **Step 5: Run unit tests — expect PASS**

```bash
cd /Users/satwik/Desktop/techxpert-store/server && npm test
```

Expected: existing suite still green + new tests green.

- [ ] **Step 6: Manual proof**

```bash
curl -sS "$STORE_API/orders" \
  -H "X-Service-Client: homecare" \
  -H "X-Service-Secret: $SECRET" \
  -H "X-Act-As-User-Id: $USER_ID"
```

Expected: 200 list for that user. Wrong secret → 401. Missing act-as → 400. Act-as other user’s order id → 403.

- [ ] **Step 7: Document in `docs/APP_API_GUIDE.md`** a short “Service credentials (Homecare bridge)” section.

- [ ] **Step 8: Commit only if the human asks**

---

### Task 3: Store service-credential auth (cart + checkout write path)

**Files:**
- Modify: `server/src/middleware/serviceAuth.ts` / scopes
- Modify: `server/src/routes/cart.ts`
- Modify: `server/src/utils/serviceAuth.test.ts`
- Modify: `docs/APP_API_GUIDE.md` UC-10 note: Homecare bridge must send `channel=homecare_app`

**Interfaces:**
- Consumes: Task 2 middleware
- Produces: Homecare can drive Mode B checkout as a user without a Store customer JWT

- [ ] **Step 1: Add failing tests for scope gating `cart:write` and `checkout:write`**

- [ ] **Step 2: Allow service act-as on:**
  - `GET /cart`, `PUT /cart/items/:productId`, `POST /cart/merge`, `DELETE /cart`
  - `POST /cart/checkout`

Service auth uses `{ userId }` access path (not guest `x-session-id`) unless you explicitly also support guest bridge (not required for Phase 1 MVP — require OTP before materials checkout).

- [ ] **Step 3: Ensure checkout without `channel` defaults `store_app`; Homecare proxy will set `homecare_app`**

Do not change default behaviour for Store Expo.

- [ ] **Step 4: Regression — Store Expo path**

With a normal customer Bearer token (no service headers), place COD checkout. Expect success and `channel` null or `store_app` as today’s default.

- [ ] **Step 5: `npm test` green + manual dual-path proof (Bearer vs service)**

---

### Task 4: Homecare Store API client (passthrough only)

**Files:**
- Create: `Homecare/backend/src/config/storeClient.js`
- Create: `Homecare/backend/src/services/storeApiClient.js`
- Create: `Homecare/backend/tests/storeApiClient.test.js` (mock HTTP)
- Modify: Homecare `.env.example` if present / deploy docs — `STORE_API_BASE_URL`, `STORE_SERVICE_CLIENT`, `STORE_SERVICE_SECRET`

**Interfaces:**
- Consumes: Store service auth contract
- Produces: `storeApiClient.getOrders(userId)`, `getCart(userId)`, `setCartLine(...)`, `checkout(userId, body)`, `getProducts(query)`

- [ ] **Step 1: Implement client with zero price math**

```js
// Pseudocode shape — implement against real Store response envelopes
async function storeFetch(path, { method, userId, body, scope }) {
  // headers: X-Service-Client, X-Service-Secret, X-Act-As-User-Id, Content-Type
  // throw on non-2xx with Store's `error` string preserved for the app
}
```

- [ ] **Step 2: Unit-test that checkout body always receives `channel: 'homecare_app'` when using `checkout()` helper** (helper injects it if missing; never strips it).

- [ ] **Step 3: Integration smoke (local)**

From Homecare node REPL or a small script: `getOrders(userId)` returns same count as Store direct call.

---

### Task 5: Homecare `GET /api/activity` (Phase 0 ship)

**Files:**
- Create: `Homecare/backend/src/routes/activity.js`
- Create: `Homecare/backend/tests/activity.test.js`
- Modify: `Homecare/backend/src/app.js` — `app.use('/api/activity', activityRouter)` (or mount get on a small router)

**Interfaces:**
- Consumes: `storeApiClient.getOrders`, existing booking/lead list helpers
- Produces: Activity DTO from contract

- [ ] **Step 1: Write failing test — unauthenticated → 401**

- [ ] **Step 2: Write failing test — merges booking + store_order items sorted by `createdAt` desc**

Use mocks for Store + booking queries.

- [ ] **Step 3: Implement compose**

Algorithm:
1. `verifyJWT`
2. If flag `UNIFIED_ACTIVITY_V1` off → 404 or empty with message (pick one; document)
3. Load Homecare bookings (reuse `get_user_bookings` query logic; prefer extracting a shared function rather than copy-paste SQL)
4. Load leads list for user
5. Load Store orders via `storeApiClient.getOrders(req.user.id)`
6. Map each to Activity item; sort; paginate with `?page&limit`
7. If Store call fails → still return Homecare items + `meta.storeOrdersError: true` (degraded, not 500). Never fail the whole Activity feed because Store is down.

- [ ] **Step 4: Manual proof with both domains’ data for one user**

- [ ] **Step 5: Feature flag default OFF in production env until Homecare app ships UI**

---

### Task 6: Homecare materials bridge routes (Phase 1 backend)

**Files:**
- Create: `Homecare/backend/src/routes/storeBridge.js`
- Create: `Homecare/backend/tests/storeBridge.test.js`
- Modify: `Homecare/backend/src/app.js`

**Suggested mounts** (keep thin):

| Homecare route | Forwards to Store |
|---|---|
| `GET /api/store/catalog/products` | `GET /catalog/products` |
| `GET /api/store/catalog/products/:id` | `GET /catalog/products/:id` |
| `GET /api/store/delivery/check` | existing Store delivery check endpoint |
| `GET /api/store/cart` | `GET /cart` |
| `PUT /api/store/cart/items/:productId` | `PUT /cart/items/:productId` |
| `POST /api/store/cart/checkout` | `POST /cart/checkout` + force `channel=homecare_app` |
| `GET /api/store/orders` | `GET /orders` |
| `GET /api/store/orders/:id` | `GET /orders/:id` |

- [ ] **Step 1: Flag `HOMECARE_STORE_BRIDGE_V1` — when off, all `/api/store/*` return 404**

- [ ] **Step 2: Tests — checkout proxy injects channel; does not alter totals fields from Store JSON**

- [ ] **Step 3: Implement proxy**

Rules:
- Require Homecare `verifyJWT` for cart/checkout/orders
- Catalog may be public or JWT (match product decision; default JWT for consistency)
- Pass through Store status codes and `error` strings
- Log `service=storeBridge`, `userId`, `storePath`, `status` (no secrets)

- [ ] **Step 4: End-to-end local proof**

Homecare token → add Store line via bridge → checkout COD → Activity shows `kind=store_order` with `channel=homecare_app`.

- [ ] **Step 5: Confirm Store Expo still checkouts with Bearer only (no bridge)**

---

### Task 7: Homecare customer app — Activity + Store entry (Phase 0–1 UI)

**Files:** (in Homecare customer app repo / Ionic project — locate actual paths during Task 0 if needed)

Typical touch points (adjust to real tree):
- Activity / orders screen
- New “Materials” or Shop entry
- Feature flag remote config or env

- [ ] **Step 1: Activity screen reads `GET /api/activity` when flag on; falls back to bookings-only when off**

- [ ] **Step 2: Materials browse → PDP → cart → checkout using `/api/store/*` only (not Homecare service cart)**

Copy UX constraints from Store APP guide: send `expectedTotal`, show Store refusal strings as-is, pincode/serviceability before checkout.

- [ ] **Step 3: After checkout, deep link to Activity item / Store order detail via bridge**

- [ ] **Step 4: QA checklist**
  - Mode A booking still works unchanged
  - Materials-only purchase works
  - Empty materials cart
  - Store down → Activity still shows bookings
  - Double-submit checkout does not duplicate (Store cart replay)

---

### Task 8: Store Expo app alignment checklist (no feature work required unless broken)

**Files:**
- Modify only if regression found: `techxpert-store/app/**`
- Create: `techxpert-store/docs/contracts/store-app-phase-0-1-regression.md`

- [ ] **Step 1: Run through Mode B on Store Expo against Store API** (home → cart → COD)

- [ ] **Step 2: Confirm app does not send service headers**

- [ ] **Step 3: Confirm orders list still `GET /orders` with customer JWT**

- [ ] **Step 4: Record pass/fail in regression doc**

If anything broke due to auth middleware changes, fix in Store middleware with tests — do not “fix” by teaching Expo service auth.

---

### Task 9: Ops visibility (minimal)

**Files:**
- Modify: Store portal orders UI only if channel already displayed; else add read-only channel badge when `order_channel` present — `web/src/components/OrdersManager.tsx` (inspect first)
- Homecare admin: optional note on customer profile “Store orders: see Store portal” (no full merge)

- [ ] **Step 1: Ensure staff can see `homecare_app` vs `store_app` on a Store order**

- [ ] **Step 2: Document support routing: materials issues → Store desk; booking issues → Homecare desk**

---

### Task 10: Phase 0–1 exit review + Phase 2 readiness spike list

**Files:**
- Create: `techxpert-store/docs/superpowers/plans/2026-11-20-unified-commerce-phase-2-preview.md` (short)

- [ ] **Step 1: Exit criteria checklist (all must be true)**

| # | Criterion | Evidence |
|---|---|---|
| 1 | Same customer id proven across JWTs | discovery notes |
| 2 | `GET /api/activity` returns bookings + store orders | curl / app screenshot |
| 3 | Homecare materials COD works via Store rules | order row + `homecare_app` channel |
| 4 | Store Expo Mode B still works | regression doc |
| 5 | No Store price math in Homecare | code review of `storeBridge` / `storeApiClient` |
| 6 | Flags can disable Activity + bridge | config proof |
| 7 | `npm test` green in Store; Homecare bridge tests green | CI/local |

- [ ] **Step 2: Write Phase 2 preview** (not implement): soft bundle, `techxpert_orch` tables, Orchestrator package location decision, service↔SKU map in Store, partial-failure UX — link back to design spec §6.

- [ ] **Step 3: List spikes required before Phase 3:** reservation API design, `hold_slot` durability across PayU redirect, PayU webhook idempotency against orch states.

- [ ] **Step 4: Human approval to close Phase 0–1 program slice**

---

## Phase 2 / 3 (not in this plan — alignment only)

Do **not** implement below until Phase 0–1 exit review passes.

### Phase 2 (soft bundle) — next plan to write
- Introduce Orchestrator deployable + `techxpert_orch.checkout_groups|legs|events|idempotency_records`
- Store-owned `service_sku_links` + portal UI
- Unified cart compose endpoint (read-only composition)
- Soft checkout: PayU service then Store COD; `PARTIAL_SUCCESS` UX
- Parent `TX-GRP-*` reference
- Still no stock reservation

### Phase 3 (hard bundle) — later plan
- Store reserve/commit/release
- Verify Homecare hold semantics
- Single PayU + payment_allocations
- Saga worker + finance exception queue
- Never show confirmed on PayU redirect alone

---

## Test & rollout (Phase 0–1)

**Automated**
- Store: service auth unit tests + full `npm test`
- Homecare: activity + storeBridge tests with mocked Store

**Manual matrix**

| Scenario | Expected |
|---|---|
| Activity, Store up | Bookings + orders |
| Activity, Store down | Bookings + degraded meta |
| Bridge flag off | `/api/store/*` 404 |
| Materials checkout | COD order + `homecare_app` |
| Store Expo checkout | Unaffected |
| Wrong service secret | 401 |
| Act-as user A read user B order | 403 |

**Rollout**
1. Deploy Store service auth (no behaviour change for Expo)
2. Deploy Homecare client + Activity flag OFF
3. Enable Activity for staff test accounts
4. Enable Store bridge for staff → one pincode → wider
5. Keep recovery/logging even if flags turn off new UI

---

## Self-review (plan author)

| Spec requirement | Task |
|---|---|
| Shared identity without SSO rewrite | 0, 1, 2 |
| Unified Activity compose | 5 |
| Materials in Homecare via Store | 3, 4, 6, 7 |
| `homecare_app` channel | 0, 3, 6 |
| Store Expo first-class | 8 |
| Least redundant / no Homecare price math | 4, 6, Global Constraints |
| Soft/hard Mode C deferred | Phase 2/3 section |
| Orchestrator/`techxpert_orch` deferred | File map + Phase 2 |
| Feature flags | 5, 6, rollout |
| Ops channel visibility | 9 |

Placeholder scan: none intentional; Homecare Ionic exact file paths depend on app repo location — Task 7 says locate during Task 0.

---

## Execution handoff

**Plan complete and saved to:**
- Spec: `docs/superpowers/specs/2026-11-20-unified-commerce-design.md`
- Phase 0+1 plan: `docs/superpowers/plans/2026-11-20-unified-commerce-phase-0-1.md`

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — execute tasks in this session with checkpoints  

**Which approach?** Start with **Task 0 discovery** either way — no Mode C payment work yet.
