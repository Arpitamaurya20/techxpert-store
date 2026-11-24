# Unified commerce — Phase 0–1 contract

**Status:** Approved (Task 1 sign-off 24 Nov 2026). Task 2+ may implement against this file.  
**Owner:** `techxpert-store` (`docs/contracts/**`) until an Orchestrator repo exists.  
**Sources:** [design](../superpowers/specs/2026-11-20-unified-commerce-design.md) §10–13; [discovery notes](./unified-commerce-discovery-notes.md); [Phase 0–1 plan](../superpowers/plans/2026-11-20-unified-commerce-phase-0-1.md).  
**Fixtures:** [`fixtures/`](./fixtures/).

Contract version for headers and vendoring: **`1`**.

---

## 1. Identity

| Name | Meaning |
|---|---|
| `customerId` | `homecare.users.user_id` (positive integer) |
| Store customer JWT claim | `userId` (= same id) |
| Homecare access JWT claim | `sub` (string form of same id) → Homecare `req.user.id` |
| Cross-domain join (services that do **not** share `homecare.users`) | Normalized **10-digit** Indian mobile (design §10.5) |

Phase 0–1 Homecare ↔ Store always join on `customerId` / `user_id` while both use `homecare.users`.

---

## 2. Auth

**Secret:** one dedicated shared secret `HOMECARE_STORE_BRIDGE_SECRET` (not either app’s master `JWT_SECRET`).  
**Issuer:** Homecare (`iss` = `homecare`).  
**Verifier:** one Store function (bridge middleware); Store Expo customer JWT path unchanged.

| | Server-to-server | Client exchange |
|---|---|---|
| `aud` | `techxpert-store-s2s` | `techxpert-store-client` |
| TTL | **60 seconds** | **15 minutes** |
| `scope` | `orders:read` only | `catalog`, `delivery`, `cart`, `checkout`, `orders` only |
| Accepted on | `/service/v1/*` only | Customer routes matching those scopes |
| Minted by | Homecare backend, per S2S call | `POST /api/auth/store-token` behind Homecare **customer** `verifyJWT` |
| Refresh | None | Ionic keeps token in memory; refresh on `401` or &lt;2 min left |

**Claims (both audiences):** `iss`, `sub`, `aud`, `scope`, `exp`.  
**Exchange only:** `channel` = `homecare_app`.

**Hardening (locked):**

- Reject bridge tokens on every staff / portal route.
- `POST /api/auth/store-token` refuses Homecare admin sessions.
- Exchange tokens: no Store profile or address **writes** (addresses stay on Homecare APIs).
- Store kill switch: `ALLOW_HOMECARE_EXCHANGE_TOKENS` default **`false`**.
- Ionic calls Store with Bearer exchange token; web Homecare uses cookie to mint, then Bearer to Store.
- S2S base URL: private only — green `http://127.0.0.1:5003` (blue later `5001` or env). Never the public host.
- Apache on Store API host: public **403** for `^/(api/)?service(/|$)`.

**Task 0:** dual HS256 verifier is feasible; Task 6 Homecare write proxy is **not** the default path.

---

## 3. ActivityItem v1

Homecare `GET /api/activity` returns items shaped as below. Adapters convert domain money to paise **once** (rupees × 100, nearest integer).

| Field | Type | Notes |
|---|---|---|
| `schemaVersion` | integer | `1` |
| `id` | string | Domain-prefixed, e.g. `booking:123`, `store_order:456`, `lead:678` |
| `domain` | string (open) | `homecare`, `store`, … |
| `kind` | string (open) | Clients render unknown kinds generically |
| `title` | string | |
| `statusCode` | enum | `open`, `in_progress`, `done`, `cancelled`, `needs_attention` |
| `statusLabel` | string | Raw domain text |
| `amountPaise` | integer | |
| `amountKind` | enum | `paid`, `cod_due`, `payable`, `estimate` |
| `createdAt` | ISO-8601 | |
| `updatedAt` | ISO-8601 | |
| `deepLink` | string | |
| `channel` | string or null | `store_app`, `homecare_app`, or null |
| `nativeRef` | string | e.g. `BK-…`, `TX-ORD-…`, `LD-…` |
| `groupRef` | string or null | Reserved for `TX-GRP-*`; **null** in Phase 0–1 |

Fixtures: `fixtures/activity-item-booking.json`, `activity-item-store-order.json`, `activity-item-unknown-kind.json`.

---

## 4. Pagination

Keyset cursor string:

```text
before = <ISO-8601 timestamp>|<id>
```

- Each source returns items **strictly older** than the cursor, **newest first**.
- Response: `{ items, nextCursor, meta }` where `nextCursor` is null at the end.
- `meta.sources`: per-source `{ name, status, error? }` (`ok` | `error` | `skipped`).
- Homecare merges bookings, leads, and Store S2S orders. Store S2S list: `GET /service/v1/orders?before=&limit=`.

Fixture page (one source failed): `fixtures/activity-page-partial-failure.json`.

---

## 5. Channel rule

When the request is authenticated with a **client exchange** token that carries `channel` = `homecare_app`:

1. Store sets `order_channel` from the **verified claim**.
2. Any body `channel` is **ignored**.

Store Expo (own customer JWT, no bridge claim) still defaults to `store_app` when body omits channel.

---

## 6. Idempotency

`POST /cart/checkout` accepts optional header `Idempotency-Key` (Phase 1). Store Expo need not send it.

| Behaviour | Result |
|---|---|
| Same key + same body hash | Replay stored response |
| Same key + different body hash | `409` |
| Same key while first in flight | `409` until first completes |
| Existing `cartId` replay | Unchanged |

Store table: `techxpertstore.checkout_idempotency`, unique (`user_id`, `idempotency_key`), fields `request_hash`, `status_code`, `response_json`, `expires_at` (24h). Phase 2 Orchestrator **requires** this header.

---

## 7. Guest orders

- A guest order stays a guest order even if `GuestPhone` matches an account.
- Activity **does not** match by `GuestPhone`.
- Guest orders are **excluded** from `GET /api/activity` in Phase 0–1.

---

## 8. Versioning

| Rule | Detail |
|---|---|
| S2S path | `/service/v1/*` (and `/api/service/v1/*` if mounted under `/api`) |
| Header | Every S2S (and Activity) response: `X-Contract-Version: 1` |
| Fixtures | Shared under `docs/contracts/fixtures/`; Homecare vendors a stamped copy |
| Breaking change | New `/service/v2/*`; serve N and N−1 for at least one release |
| Approval | Each consuming repo owner signs contract edits |

---

## 9. Feature flags (yes — flag-controlled rollout)

Phase 0–1 is **ship dark, enable later**. Code can be on green while customer-facing surfaces stay off until you flip a flag (or a cohort allow-list). That is intentional: deploy ≠ launch.

| Flag / switch | Where | Default | Purpose |
|---|---|---|---|
| `ALLOW_HOMECARE_EXCHANGE_TOKENS` | Store **`.env`** (process restart) | `false` | Kill client exchange acceptance |
| `UNIFIED_ACTIVITY_V1` | Homecare DB table `feature_flags` (+ optional env `UNIFIED_ACTIVITY_V1=0` hard kill) | **off** (`enabled=0`) | `GET /api/activity` → `404 FLAG_OFF` until on |
| `homecare_store_entry` | Homecare `feature_flags` | off | Hide materials entry in Homecare app (when UI lands) |

Cohort flags live in Homecare MySQL (`feature_flags`). Store kill switches are env vars.

### Where to run Activity enable (one place)

| Lane | Database | Host / tool | Do **not** |
|---|---|---|---|
| **Green (test)** | `homecare_green` | VPS: `mysql` SSH, or phpMyAdmin → select **`homecare_green`** | Touch `homecare` (blue/prod) |
| **Blue (prod)** | `homecare` | Only when you explicitly cut over | Flip green flags expecting prod to change |

**1. Create / seed the table once** (green first), from Homecare backend tree on the VPS or any machine that can reach MySQL:

```bash
# SSH on VPS — green only
mysql -u green_app -p homecare_green < /var/www/green-node/homecare-backend/sql/feature_flags.sql
```

(Or phpMyAdmin → `homecare_green` → Import / run the SQL file.)

**2. Turn Activity on for everyone on green:**

```sql
-- Run while connected to homecare_green (not homecare)
UPDATE feature_flags
SET enabled = 1
WHERE flag_key = 'UNIFIED_ACTIVITY_V1';
```

**Or cohort only** (keep `enabled = 0`, allow listed `user_id`s):

```sql
UPDATE feature_flags
SET enabled = 0,
    allow_user_ids_json = '[12345]'   -- your test homecare.users.user_id
WHERE flag_key = 'UNIFIED_ACTIVITY_V1';
```

Flag rows are cached ~30s in the Homecare API process — wait briefly or restart `homecare-api-green` if it still returns `FLAG_OFF`.

**Env hard kill** (Homecare green `.env`): `UNIFIED_ACTIVITY_V1=0` forces off even if the DB row is enabled.

---

## 10. Non-goals (Phase 0–1)

From design §7, in scope for this contract as **out**:

- Mode C soft/hard bundle, `TX-GRP-*`, Orchestrator, `techxpert_orch`
- Stock reservation, single PayU for materials+services
- SSO / RS256 / JWKS rewrite
- Static service-secret write master keys; Homecare reimplementing Store pricing/stock
- Matching Activity by `GuestPhone`
- Returns/RMA, unified tax invoice, unified admin portal, rebuilding Store Expo
- Pairwise proxies as a template for service #3

---

## Discovery anchors (Task 0)

| Gate | Contract assumption |
|---|---|
| G1 | Ionic Bearer to Homecare; exchange Bearer to Store |
| G2 | Homecare `address_id` = Store checkout `addressId` |
| G3 | S2S on loopback / private network |
| G4 | `homecare_app` on `order_channel`; forced from token once exchange exists |

---

## Sign-off (Task 1 gate)

| Role | Name | Date | Notes |
|---|---|---|---|
| Engineering | | | Approve before Task 2 |
| Homecare consumer (optional) | | | |
