# Unified Techxpert Commerce — Locked Architecture

**Status:** Approved direction (founder/engineering alignment)  
**Date:** 20 Nov 2026  
**Repos:** `techxpert-store` + `Homecare`  
**Next:** Phase 0+1 implementation plan in [`../plans/2026-11-20-unified-commerce-phase-0-1.md`](../plans/2026-11-20-unified-commerce-phase-0-1.md)

This document locks the architecture that came out of the planning brief and the Gemini/Claude synthesis. It is the source of truth for sequencing. It does **not** authorize Mode C hard-bundle (Phase 3) work until Phase 0–2 ship.

---

## 1. Locked decisions

| Decision | Lock |
|---|---|
| Long-term architecture | Thin **Commerce Orchestrator** coordinates domains; does not own pricing, stock, slots, or booking rules |
| First unified customer surface | **Homecare Ionic/Capacitor app** |
| Store Expo app (`techxpert-store/app`) | Remains first-class **materials-only** client; never second-class; always talks Store commerce contracts |
| Mode C initial (Phase 2) | Soft bundle: one UX, **split** PayU (services) + COD (materials); partial success is a real state |
| Mode C final (Phase 3) | Hard bundle: reservations + slot holds + **one PayU** + saga + reconciliation |
| Cart | One **visible** cart; two **domain-owned** carts (never a polymorphic master cart) |
| Stock / SKU pricing | **Store API only** |
| Booking / slots / wallet / service PayU | **Homecare API only** |
| Cross-domain state | New schema **`techxpert_orch`** (Orchestrator-owned migrations) |
| Identity | Shared `homecare.users` phone identity; **no** RS256/JWKS/SSO rewrite as a Mode C blocker |
| Invoices | Separate goods + services GST docs; one parent group summary |
| Mode C materials | Curated, **optional**, pre-purchased Store SKUs |
| Technician quote materials | Stay separate from Store purchasing |
| Service↔SKU map | Lives in **`techxpertstore`**, maintained in Store portal |
| Parent customer reference | `TX-GRP-*` (orchestration); legs keep `BK-*` / `TX-ORD-*` |
| Dual-repo rule | Domain logic implemented **once**; other side only adapts/calls |
| Soft bundle marketing | Never call Phase 2 “atomic” or “one payment” |

### Explicitly not locked yet

- Exact SSO/token-exchange mechanism (separate security review)
- Orchestrator deploy host / process layout (spike in Phase 2)
- Seller-of-record / wallet-on-materials / combined tax invoice (founder/accountant)

---

## 2. Target shape

```
Homecare Ionic app ──► Commerce Orchestrator (Phase 2+) ──┬──► Homecare API ──► homecare DB
   (unified UI)                                            │         ▲
                                                           │         │ identity tables
Store Expo app ──────► Store API (direct) ─────────────────┴──► techxpertstore DB
   (Mode B forever)                                              │
                                                                 └── service↔SKU maps

Orchestrator DB: techxpert_orch (checkout groups, legs, events, idempotency, payment allocations)
```

**Phase 0–1 exception:** Orchestrator service is **not** required yet. Homecare may compose Activity and proxy materials reads/writes to Store via **service credentials**, without reimplementing Store money/stock rules. Full Orchestrator + `techxpert_orch` arrives with Phase 2 checkout groups.

### Must / must-not ownership

| Component | Owns | Must not own |
|---|---|---|
| Homecare API | Services, bookings, slots, tickets, wallet, service PayU | Store stock, SKU price, bulk tiers |
| Store API | Catalogue, variants, price, stock, COD orders, delivery | Booking lifecycle |
| Orchestrator (Phase 2+) | Composition, group refs, saga, idempotency, reconciliation | Domain business records |
| Homecare app | Unified customer UI (first) | Transactional truth |
| Store Expo app | Materials shopping UX | Unified booking transaction |
| `techxpert_orch` | Cross-domain state only | Domain tables |

**Orchestrator (and Homecare proxies) never write directly to** `homecare.bookings`, `homecare.payment_orders`, `techxpertstore.orders`, stock tables, or carts. They call domain APIs and store **references**.

---

## 3. Modes

### Mode A — services only
Existing Homecare path unchanged. Do not force pure service checkout through cross-domain saga in MVP.

### Mode B — materials only
Existing Store path unchanged for Store Expo app. Homecare app may place the **same** Store checkout with `channel=homecare_app`.

### Mode C — services + materials
- Discovery: curated optional SKUs on direct-book services (sellable only).
- Soft bundle (Phase 2): one cart UI, two payment obligations, explicit partial-failure recovery.
- Hard bundle (Phase 3): reserve → hold → PayU verify → commit both → reconcile.

---

## 4. Soft vs hard bundle (non-negotiable)

| | Phase 2 soft | Phase 3 hard |
|---|---|---|
| UX | One cart, two sections | One cart, one payable |
| Money | PayU service + COD materials | Single PayU |
| Stock | Decrement at Store COD create (today) | Soft reservation + TTL before pay |
| Failure | Partial success allowed + recovery UX | Saga + compensation / manual review |
| Promise to customer | Grouped journey, **not** one atomic txn | Coordinated confirmation only after both commits |

PayU return / webhook success ≠ checkout complete. States must include at least: `PAYMENT_CONFIRMED`, `COMMITTING`, `PARTIAL_SUCCESS`, `COMPENSATING`, `REFUND_PENDING`, `MANUAL_REVIEW`.

---

## 5. Work partition (least redundant)

| Capability | Homecare API | Store API | Homecare app | Store Expo app | Orch / `techxpert_orch` |
|---|---|---|---|---|---|
| OTP / `users` identity | Own | Read / attach | Use Homecare auth | Use Store auth (same users) | Logical `customer_id` only |
| Service cart / booking / PayU | Own | — | Mode A UI | — | Call only |
| Materials price / stock / COD | — | Own | Call Store contracts (via proxy or direct) | Call Store directly | Call only |
| `order_channel` | — | Own (`store_app` / `homecare_app`) | Send `homecare_app` | Send `store_app` | Pass through |
| Service↔SKU map | Consume | Own + portal UI | Show rails | Optional later | Read via Store |
| Activity feed (Phase 0) | Compose | Provide `GET /orders` | Render | Render own orders | Later owner |
| Checkout groups (Phase 2+) | Leg APIs | Leg APIs | Unified checkout UI | Unaffected Mode B | Own |
| Stock reservation (Phase 3) | — | Own new APIs | — | Unchanged UX | Call |
| Slot hold (Phase 3) | Own (verify first) | — | — | — | Call |

**Forbidden duplicates:** Homecare must not reimplement Store `cartRules` / bulk tiers / stock. Store must not reimplement booking fee / visit / slot math.

---

## 6. Phased roadmap (locked sequence)

| Phase | Goal | Ship | Reversible |
|---|---|---|---|
| **0** | Connect experience: identity contract, Activity compose, flags | Unified My Activity | Hide Activity compose |
| **1** | Store materials inside Homecare (Mode B bridge) | Buy materials from Homecare app via Store rules | Hide Store entry |
| **2** | Mode C soft bundle | Grouped journey + partial-failure UX | Flag off bundle |
| **3** | Mode C hard bundle | Reservations, one PayU, saga, reconcile | Disable new Mode C; keep recovery |

**Do not start Phase 2 payment grouping or Phase 3 saga until Phase 0–1 are proven.**  
**Do not bundle auth SSO migration into Phase 0.**

Planning ranges (not commitments): Phase 0 = 2–4w, Phase 1 = 3–5w, Phase 2 = 4–8w, Phase 3 = 8–14w+.

---

## 7. MVP non-goals

Returns/RMA automation, credit terms, ERP/warehouse transfers, van inventory, auto BOM consume, lead_quote+materials, timed+materials, cross-domain wallet/coupons, unified admin portal, unified tax invoice, rewriting either backend, rebuilding Store Expo, mandatory kits, silent material substitution.

---

## 8. Open questions (block Mode C go-live; not all block Phase 0–1)

**Product/ops:** recommendation vs kit vs BOM; mapping owner; tech substitute rules; delivery vs appointment timing; unused materials; returns liability.  
**Finance:** split PayU+COD acceptable?; final single PayU?; allocation/seller of record; wallet on Store; separate GST required?  
**Tech:** safe Homecare slot hold without booking?; any Store reservation today beyond checkout decrement?; idempotent commit on both sides?; Store trusts Homecare token vs orch exchange?; orch deploy owner; stuck-txn owner.

---

## 9. Recommended next step

Execute **Phase 0 + Phase 1 only**, starting with repository discovery spikes, then the plan in [`../plans/2026-11-20-unified-commerce-phase-0-1.md`](../plans/2026-11-20-unified-commerce-phase-0-1.md). No Mode C soft/hard payment work until that plan’s exit criteria pass.
