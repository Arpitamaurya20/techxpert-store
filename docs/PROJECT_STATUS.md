# Techxpert Store — status and audit index

As of **23 Oct 2026**. One page that says what was built, why, by which files, and what comes next. Detail lives in the linked docs; this file points to them.

**State of the repo:** pushed to GitHub as four commits on top of `1df128a` (`feef46e` server, `8092aa6` portal, `68923f1` phone app, `d698a52` docs), which are on both `main` and `develop`. From here all work is committed on **`develop`**; `main` moves only when asked. All database proof was run against the **local** MySQL (`homecare` + `techxpertstore` on localhost), not production.

---

## 1. Vision

- **Customer phone app** (`app/`, Expo) for construction and home materials: browse, cart, deliver-to-pincode, cash-on-delivery order.
- **Merchandising portal** (`web/`, Vite React) so staff run the catalogue, homepage, banners, bulk pricing, delivery areas and orders **without a developer or an app release**.
- **One API** (`server/`, Express + MySQL) that is the single source of truth: it decides prices, owns the cart, says where we deliver, writes the order, and decides who on staff may do what.
- **Two schemas on one MySQL host:** `homecare` (identity, shared with the Homecare product — logins, customers, addresses; its schema is never changed from here) and `techxpertstore` (catalogue, carts, orders, CMS, pincodes, stores, portal roles).
- **Out of scope:** payment, refunds, invoices, a customer website, ERP, per-store stock (for now), Homecare code.

## 2. Working rules

1. One phase at a time; verify it (tests, local DB proof with explicit cleanup, HTTP or browser check) before the next.
2. The server decides money and access; the phone and portal only display and ask.
3. A refusal is an HTTP 4xx with a sentence a person can act on; a failure never pretends to succeed (no file-store orders, no invented prices or stock).
4. No change to the `homecare` schema. No commits unless asked.

Source: [`AGENTS.md`](../AGENTS.md), [`WEB_SPEC.md` §5](./WEB_SPEC.md), [`SHOP_TRACK.md`](./SHOP_TRACK.md).

---

## 3. What is built

| Track | What it gives | Status | Detail |
|---|---|---|---|
| Portal P1–P11 + hardening | Catalogue CRUD at 110k SKUs, categories, banners (schedule, upload, live-only to phone), homepage sections the app actually draws, price/stock/tier edit in place, persisted audit, staff login (HttpOnly cookie, live deactivation), security fixes H1–H4, M1–M9, L1–L5 | Done; P11 staging run pending | [`WEB_SPEC.md`](./WEB_SPEC.md), [`WEB_PORTAL_AUDIT.md`](./WEB_PORTAL_AUDIT.md) |
| Shop S0 | Server prices at checkout; client prices ignored | Done | [`SHOP_TRACK.md`](./SHOP_TRACK.md) |
| Shop S1 | Server cart for guests and customers; guest cart merges on sign-in | Done; device run pending | same |
| Shop S2 | Delivery pincodes: phone checks before checkout, server refuses others; portal tab | Done; device run pending | same |
| Shop S3 | Order placed from the server cart (COD), one order per cart, honest product page | Done; device run pending | same |
| Portal access A1 | Store roles with View/Edit/Delete per module, assigned to existing staff; portal shows only what the role allows; no escalation | Done (local + browser proof) | [`PORTAL_ACCESS.md`](./PORTAL_ACCESS.md) |
| Portal access A2 | Stores ↔ pincodes, a free tree of groups above stores, staff scope, orders tagged by store | **Built on `develop`** and proven on the local DB (61/61 HTTP checks, browser check); production needs `portal_scope.sql` before the API restart | [`PORTAL_ACCESS.md` §A2](./PORTAL_ACCESS.md) |
| Portal access A3 | Store-owned staff list: store logins, plus linked Homecare logins for people in both; Homecare logins no longer listed | **Server built (S1)** on `develop`, proven on the local DB; portal screens (S2) next. Production: `portal_staff.sql`, then `npm run staff:bootstrap`, then the API restart, ideally together with S2 | [`PORTAL_ACCESS.md` §A3](./PORTAL_ACCESS.md) |

### Staff hierarchy (A1 + A2)

Two independent answers decide what a staff member gets: **what they may do** (role, A1) and **where** (scope, A2).

**Who — the staff list (A3, server built).** The store keeps its own staff list. A person is either a store login or a linked Homecare login, for someone who works in both and keeps one password. Homecare people who aren't linked never appear and can't sign in. Super admin is a flag on the store's list, created with `npm run staff:bootstrap`; Homecare's `super_admin` role no longer counts.

**What — roles (built).** Super admin has everything and is never given a store role. Everyone else gets one store role, created in the portal, with View / Edit / Delete per module (products, categories, pricing, banners, sections, orders, delivery, stores, customers, audit, access). Edit or Delete implies View. Nobody can grant more than they hold, edit their own role, change themselves, or change someone who holds more. The A1 roles copied from Homecare roles were removed in A3.

**Where — stores and groups (built).**

- Each pincode belongs to exactly one store; a store serves many pincodes.
- Above stores is a free tree the company builds itself: groups named Zone, Area, Cluster… at any depth; stores and groups can be moved.
- A staff member's scope is one or more places in that tree, or the whole company. A place covers everything under it, including stores added later.
- Example: Store A (pincodes set 1) and Store B (pincodes set 2) can have different managers (each scoped to their store) or one manager (scoped to both); an area manager is scoped to the group containing both and sees everything in it.
- You can only give scope inside your own; only whole-company staff can give whole company. Existing staff started as whole company; someone with a role but no places sees no orders, pincodes or customers.
- An order to a pincode that no active store serves is refused.
- Scope filters orders (by the store recorded at checkout), delivery pincodes, and customers who ordered from those stores. Catalogue, banners, sections and pricing stay company-wide.
- Stock stays shared company-wide for now; per-store stock is a later step.

Full decisions, tables and the as-built API: [`PORTAL_ACCESS.md`](./PORTAL_ACCESS.md) (§A2 "As built").

---

## 4. Core logic and the file responsible

What an auditor should check, where it lives.

### Money, stock, cart, order

| Rule | Where |
|---|---|
| Unit price = lowest active `product_pricing.SellingPrice`; none → product not orderable (no ₹450 fallback) | `server/src/utils/cartRules.ts` (`priceLine`), `server/src/services/cartService.ts` (`priceRows`), `server/src/services/catalogService.ts` |
| Bulk tier applied on top of base price | `server/src/services/pricingService.ts`, `cartRules.priceLine` |
| GST 18%; delivery ₹99 below ₹2,000 subtotal, free from ₹2,000 | `cartRules.ts` (`TAX_RATE`, `DELIVERY_CHARGE`, `FREE_DELIVERY_FROM`) |
| Quantity limits and the refusal sentence | `cartRules.quantityRefusal` |
| Stock the shop sells = first variant's `product_variants.StockQuantity` (read, cart, decrement, portal write) | `catalogService.ts` (`SHOP_STOCK`, `writeCatalogueStock`), `cartService.ts`, `orderService.writeOrder` |
| Cart ownership (customer JWT or guest `x-session-id`) | `cartService.assertCartAccess`, `server/src/routes/cart.ts` |
| Checkout: COD only, expected total must match to the paisa, pincode must be served, one order per cart (`orders.CartID` unique → replay) | `server/src/services/cartCheckoutService.ts`, `cartRules.sameMoney`, `server/sql/shop_s3_checkout.sql` |
| Guest with a registered phone → guest order, account untouched | `server/src/utils/checkoutPricing.ts` (`guestOrderOwner`), `orderService.ownerForGuest` |
| DB failure → 503 "couldn't place your order", never a pretend order | `checkoutPricing.orderFailed` |
| Older `POST /orders` ignores client `userId`, `cartId`, prices | `orderService.checkout` / `createOrder` |
| Pincode format and serviceability | `server/src/utils/pincode.ts`, `server/src/services/deliveryAreaService.ts` |

### Phone

| Concern | Where |
|---|---|
| Cart state mirrors the server; optimistic taps, one request per line | `app/src/state/cartStore.ts`, `app/src/services/cartApi.ts`, `app/src/state/cartSession.ts`, `app/src/components/store/CartSync.tsx` |
| Pincode check while typing | `app/src/hooks/usePincodeCheck.ts`, `app/src/services/deliveryApi.ts` |
| Checkout uses server totals, shows server refusals, safe retry | `app/src/app/checkout.tsx`, `app/src/services/orderApi.ts`, `app/src/services/apiClient.ts` |
| Home banners and section order from the CMS | `app/src/services/cmsApi.ts`, `app/src/components/home/HeroCarousel.tsx` |

### CMS

| Rule | Where |
|---|---|
| Phone sees only banners live now (published / scheduled inside window) | `server/src/utils/bannerEligibility.ts`, `server/src/services/cmsService.ts` |
| Sections limited to blocks the app can draw, in desk order | `cmsService.ts` |
| Banner upload: JPEG/PNG/WebP ≤ 2 MB, bytes checked | `server/src/utils/bannerMedia.ts` |

### Staff access and audit

| Rule | Where |
|---|---|
| Staff login against the store's staff list (store logins, or linked Homecare logins); every request re-checks the staff row, the linked Homecare login and the last password change; temporary passwords block everything but changing them | `server/src/services/staffService.ts`, `server/src/utils/staffAccounts.ts`, `server/src/middleware/auth.ts` |
| Add, link, reset, deactivate staff, with the same hierarchy refusals as roles | `server/src/services/accessService.ts`, `server/src/routes/access.ts` |
| First super admin, from a terminal | `server/src/scripts/staffBootstrap.ts` (`npm run staff:bootstrap`) |
| Modules, levels, "edit/delete imply view", no-escalation check | `server/src/utils/permissions.ts` |
| Role CRUD, staff assignment, self/role-held/higher-role refusals | `server/src/services/accessService.ts`, `server/src/routes/access.ts` |
| Route gates `requirePermission(module, level)` | `server/src/routes/{catalog,cms,pricing,delivery,orders,audit,auth}.ts` |
| Super admin always full; permissions loaded from DB per request, never from the token | `middleware/auth.ts` (`resolveAdmin`), `accessService.forStaff` |
| Audit trail; actor taken from the session | `server/src/services/auditService.ts`, `server/src/routes/audit.ts` |
| Portal shows only allowed tabs and controls | `web/src/services/access.ts`, `web/src/App.tsx`, `web/src/components/Sidebar.tsx`, each manager component's `canEdit` / `canDelete` |
| Roles & Access screen (roles, staff role, staff places) | `web/src/components/AccessManager.tsx` |
| Places: group tree, whole-company switch, scoped orders / pincodes / customers (404 outside), scope no-escalation | `server/src/utils/scope.ts`, `accessService.ts` (`forAdmin`, `setStaffScope`), `orderService.ts`, `deliveryAreaService.ts`, `authService.getAllUsers` |
| Stores & Groups (tree, stores, pincode links) | `server/src/services/storeTreeService.ts`, `server/src/routes/stores.ts`, `web/src/components/StoreTreeManager.tsx` |
| Store on each order; refuse pincodes no active store serves | `deliveryAreaService.assertServiceable`, `cartCheckoutService.ts`, `orderService.writeOrder` |

### Tests

`cd server && npm test` — 71 unit tests: `cartRules`, `checkoutPricing`, `permissions`, `scope`, `pincode`, `bannerEligibility`, `bannerMedia`, `stockAllocation`, `deskAccess` (`server/src/utils/*.test.ts`). `npm run proof:desk` (`server/src/scripts/deskProof.ts`) checks a staging API from the outside.

---

## 5. Database changes

Run in this order on production (all applied to the local DB already). See [`server/sql/README.md`](../server/sql/README.md).

1. `server/sql/portal_audit_logs.sql`
2. `server/sql/portal_audit_logs_alter_category.sql` (only if the table predates the newer entities)
3. `server/sql/shop_s3_checkout.sql`
4. `server/sql/portal_access.sql`
5. `server/sql/portal_scope.sql`: before restarting the API on the A2 code. With more than one store, link every active pincode to a store first, or it stops.

Schema reference: [`DATABASE_SCHEMA.md`](./DATABASE_SCHEMA.md).

---

## 6. Plan of action

| # | Item | Who / where | Done when |
|---|---|---|---|
| 1 | Restart the API on :5001 on the new code (portal needs `/me` permissions) | ops | **Done** locally (restarted 23 Oct 11:52; `/api/access/*` answers) |
| 2 | Device run of shop S1–S3 | **app team** (outside this track); `app/` screens Cart, Checkout | guest cart, merge, pincode, order, repeat-tap all behave as in `SHOP_TRACK.md` |
| 3 | P11 staging desk proof | `server/src/scripts/deskProof.ts`, `WEB_SPEC.md` P11 note | `npm run proof:desk` exits 0 |
| 4 | **A2 detailed design**, agreed before build | `docs/PORTAL_ACCESS.md` §A2 (design + review R1–R9) | **Done** — D1–D4 answered 23 Oct |
| 5 | A2 build: pincode → store, group tree, staff scope, store on each order, scoped orders / pincodes / customers | `server/sql/portal_scope.sql`, `scope.ts`, `storeTreeService.ts`, `routes/stores.ts`, `accessService.ts`, `deliveryAreaService.ts`, `orderService.ts`, `StoreTreeManager.tsx`, `AccessManager.tsx` | **Done** on `develop` 23 Oct: 71/71 unit tests, 61/61 HTTP checks, browser check; local API on :5001 needs a restart to run it |
| 6 | Portal UI/UX pass: truth and wording (U1), shared building blocks (U2), screens in batches (U3–U6) | [`PORTAL_UI_PASS.md`](./PORTAL_UI_PASS.md); `web/src/components/*` | U1 done 23 Oct, with toasts, light theme in the logo colours and the logo fix; U2 done 23 Oct (shared pieces; Delivery Pincodes and Roles & Access moved onto them); U3 next |
| 7 | Production rollout | SQL in §5, then API deploy, then phone build | — |

Later, not scheduled: per-store stock, payment, cancellations/refunds, invoices, notifications.

---

## 7. Known gaps and risks

- **Few orderable products:** 110,100 of 110,106 active products have no active price; four priced products (IDs 4, 6, 7, 8) have no variant. Shown honestly as unavailable; merchandisers must add price/variant.
- **Phone sign-in is memory-only:** after an app restart the customer sees the guest cart until signing in again.
- **Stock mismatch for multi-variant products:** the shop sells the first variant only.
- **Not device-tested:** S1–S3 proven over HTTP and the local DB only; the device run is with the app team.
- **Ops:** admin login rate limit is in-memory (single node); `JWT_SECRET` and `CORS_ORIGINS` must be set in production (the API refuses to start otherwise).
- **Portal lint:** `set-state-in-effect` warnings on screens that load data on open (existing pattern, now also in `App.tsx`, `AccessManager.tsx` and `StoreTreeManager.tsx`).
- **Store codes:** the existing store's code is a long legacy value; stores created in the portal get `ST0002`, `ST0003`…
- **Branching:** work goes on `develop` (see `AGENTS.md`). Unused Vite template files (`web/src/App.css`, `web/src/assets/`, `web/public/icons.svg`, `web/public/favicon.svg`) were left out on purpose.

---

## 8. Document map

| File | Purpose |
|---|---|
| [`SRS.md`](./SRS.md) | Original requirements |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | System shape, dual DB |
| [`DATABASE_SCHEMA.md`](./DATABASE_SCHEMA.md) | Tables, including new portal tables |
| [`BACKEND_IMPLEMENTATION_SPEC.md`](./BACKEND_IMPLEMENTATION_SPEC.md) | API contract |
| [`APP_WORKFLOW.md`](./APP_WORKFLOW.md) | Phone flows |
| [`WEB_SPEC.md`](./WEB_SPEC.md) | Portal modules and P1–P11 plan with notes |
| [`WEB_PORTAL_AUDIT.md`](./WEB_PORTAL_AUDIT.md) | Security findings, fixes, AuthZ matrix |
| [`SHOP_TRACK.md`](./SHOP_TRACK.md) | Shop S0–S3 spec, as-built, proof |
| [`PORTAL_ACCESS.md`](./PORTAL_ACCESS.md) | Roles A1 and scope A2 (both built) |
| [`PORTAL_UI_PASS.md`](./PORTAL_UI_PASS.md) | Portal UI/UX pass: agreed design and phases U1–U6 |
| [`../server/sql/README.md`](../server/sql/README.md) | Migration order |
| `PROJECT_STATUS.md` (this file) | Index for audit review |
