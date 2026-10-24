# Techxpert Store — Web Application Specification

**Scope:** Web Application & Admin Merchandising Portal  
**Target:** Construction & Home Materials Commerce Platform  
**Reference:** [`docs/SRS.md`](./SRS.md) Section 8.10 & Section 9  

---

## 1. Overview & Objectives

The web workspace (`web/`) serves as the administrative and operational control center for Techxpert Store, enabling merchandising teams, category managers, and store admins to:
1. **Manage Banners & Hero Carousels**: Create, edit, schedule, preview, reorder, and publish campaign banners that reflect immediately in the mobile application.
2. **Configure Homepage Sections**: Dynamically arrange homepage sections (e.g., hero carousel, category shortcuts, trust strips, offer rails, product grids).
3. **Product & Bulk Pricing Management**: Oversee catalog items, pack sizes, bulk tier discounts, and stock levels.
4. **Order & Customer Overview**: Review recent orders, customer activity, and fulfillment statuses.
5. **Customer Web Storefront (Future / Extensible)**: Support desktop browsing for contractors and homeowners placing large material orders.

---

## 2. Core Functional Modules

### 2.1 Dashboard & Analytics Overview
- KPI cards: Active campaigns, live banners, pending orders, catalog item count.
- Recent activity timeline and audit log preview.

### 2.2 CMS & Banner Management
- **Lifecycle States**: `draft` -> `scheduled` -> `published` -> `paused` -> `archived`.
- **Form Controls**: Title, subtitle, CTA label, CTA type/route, image upload/URL preview, alt text, terms text, active date range picker.
- **Visual Preview**: Live interactive mobile and desktop banner preview showing exact visual presentation before publishing.
- **Section Ordering**: Drag-and-drop or rank-order selector for homepage layout blocks.

### 2.3 Catalog & Bulk Price Rules
- Category & product hierarchy manager.
- Bulk pricing tier editor: Minimum order quantities, percentage/fixed discounts, validity periods.
- Location availability toggles for regional warehouses.

### 2.4 Audit & Publishing History
- User identification, timestamps, and previous state snapshots.
- Single-click rollback for misconfigured campaigns.

---

## 3. Design & UX Principles
- **Theme**: Premium industrial & modern commerce aesthetic (Navy `#0f172a`, Construction Amber/Orange `#f97316`, Clean Slate `#f8fafc`).
- **Layout**: Collapsible sidebar navigation, high-density data tables, responsive modals, and real-time live preview panel.
- **Performance**: Instant filtering, search-as-you-type, optimistic UI updates, and zero layout shift.

---

## 4. What exists today (inventory)

Portal boots via Vite (`cd web && npm run dev`); API on `:5001`.

| Module | UI | API wired | Gaps |
|---|---|---|---|
| Dashboard | KPIs + shortcuts | Live aggregate load | — |
| Products & Inventory | List, filter, edit, **add, delete** | `GET/POST/PUT/DELETE /catalog/products` | Create writes MySQL (+ file fallback) |
| Categories & Subs | Hierarchy editor | `GET/POST/PUT/DELETE /catalog/categories` + `/subcategories` | Soft-delete via `IsActive` (**P4**) |
| Orders & Fulfillment | List with store, status change | `GET`, `PUT …/status` | Cancel puts stock back for shop orders; cancelled is final; delivered can't be cancelled; no refunds; limited to your places (404 outside) |
| Customers | Directory read | `GET /auth/users` | Read-only; scoped staff see customers who ordered from their stores |
| Bulk Pricing | List, add, delete tiers | Full CRUD used | No edit-in-place |
| Campaign Banners | CRUD + reorder + **live image preview + CTA validation** | Full CMS banners | File upload still out of scope (P2 uses URL/path) |
| Homepage Sections | Toggle, reorder, reset | `GET/PUT` sections | Mobile home consumes `GET /cms/sections` |
| Delivery Pincodes | List with serving store, add (with store), pause/resume | `GET/POST/PATCH /delivery/pincodes` | Add/pause need Delivery edit; checkout refuses unlisted pincodes (shop **S2**) and pincodes no active store serves (A2); list limited to your places |
| Stores & Groups | Group tree, create/rename/move groups and stores, link/unlink pincodes | `GET /stores/tree`, `POST/PUT/DELETE /stores/groups`, `POST/PUT /stores`, `GET/POST/DELETE /stores/:id/pincodes` | Stores module (View/Edit/Delete); shows only your places ([PORTAL_ACCESS.md](./PORTAL_ACCESS.md) §A2) |
| Developer tools | Endpoint tester, phone app connection | `/health` | Super admin only; not a role module |
| Audit Trail | Timeline viewer | `GET /audit/logs` (Audit view), `POST` (any role; actor taken from the session) | MySQL `portal_audit_logs` + file fallback (**P3**) |
| Staff Auth | Login gate + logout, first-sign-in password screen, Change password (sidebar and no-access screen) | `POST /auth/admin/login`, `/logout`, `GET /auth/admin/me`, `POST /auth/admin/password` | HttpOnly cookie; login and `/me` return `kind`, `mustChangePassword`, `storeRole` + `permissions`; linked people change their password in Homecare |
| Roles & Access | Roles (module × View/Edit/Delete); staff list: add a store login, link a Homecare login, rename, reset password, switch off/on; staff role and places | `GET/POST/PUT/DELETE /access/roles`, `GET/POST /access/staff`, `GET /access/staff/homecare-match`, `POST /access/staff/link`, `PUT/PATCH /access/staff/:id`, `POST /access/staff/:id/reset-password`, `PUT /access/staff/:id/scope` | Every tab and control follows the signed-in role; no escalation of role or places; only the store's staff list can sign in ([PORTAL_ACCESS.md](./PORTAL_ACCESS.md) §A3) |

Restore bootstrap if merge drops it again: `git checkout cdb6adf -- web/package.json web/vite.config.ts web/tsconfig*.json web/src/main.tsx web/src/index.css web/src/App.css web/public web/index.html` (+ shell components as needed).

---

## 5. Phase plan (one phase at a time — do not batch)

| Phase | Scope | Exit criteria | Status |
|---|---|---|---|
| **P1** | Catalog CRUD complete (Add + Delete + keep Edit) | Merchandiser can create, update, soft-delete SKUs from portal | **Done** |
| **P2** | Banner CMS polish (image URL preview + validate CTA) | Safer banner publish without broken images/routes | **Done** |
| **P3** | Persist audit trail (server table + portal viewer) | Refresh does not wipe change history | **Done** |
| **P4** | Category / subcategory editor | Portal can maintain hierarchy mobile already browses | **Done** |
| **P5** | Portal staff auth (`admin_users`; replaced by the store's own staff list in access A3) | Portal not open without login | **Done** |
| **P6** | Catalogue browse at scale | Portal search + pagination against MySQL `meta.total` (~110k SKUs); desk does not load full catalogue into memory | **Done** |
| **Low** | Audit L1–L5 polish | Optimistic audit rollback, ApiExplorer staff samples, SQL scripts, write validation, banner asset URLs | **Done** |
| **P7** | Banner publish is what the phone receives | `paused` accepted by the API; public list is published and inside the schedule window only | **Done** |
| **P8** | Homepage sections match the app allowlist | Reorder/toggle in the portal is the order `GET /cms/sections` returns and the app renders | **Done** |
| **P9** | Price, stock, and bulk tiers edit in place | Product price writes `product_pricing`, stock writes `inventory_stock`, tier can be updated without delete-and-readd | **Done** |
| **P10** | Campaign image the merchandiser can set | Upload or stored asset with type/size checks; banner stores the resulting URL | **Done** |
| **P11** | Desk proof on staging | Banner, section order, and a bulk tier changed in the portal show up on the API (and the app if a base URL is set) without an app build | **Done** (staging run pending) |

**Rule:** Finish and verify the current phase before starting the next. Do not batch phases.

### What “portal complete” means

A merchandiser, without a developer, can put a campaign on the phone home, arrange the homepage blocks the app actually renders, and correct a SKU’s price, stock, category, and bulk tier. Staff can see who changed it. Orders can be moved through status. That is the end of this plan.

Still out of this plan: payment, refunds, invoices, a customer website, ERP, and the phone’s server cart. The phone cart and ordering are the shop track after P11 ([`SHOP_TRACK.md`](./SHOP_TRACK.md)), not more portal modules.

### P11 note

Delete, Remove and Reset now follow the signed-in store role's Delete permission per module ([PORTAL_ACCESS.md](./PORTAL_ACCESS.md), A1); the API refuses anyway. The seeded Merchandiser role (state and region managers) edits but cannot delete. The phone product page lists the active bulk tiers it gets from `GET /catalog/products/:id` (“Buy 10–49: 8% off”, or a fixed unit price).

Staging proof, after the API is restarted on the new code:

1. In the portal, publish a banner, pause another, move a homepage block, and add or edit a tier on one product.
2. From `server/`, run the anonymous check against that API:

   ```sh
   PROOF_API=https://<staging-api> PROOF_BANNER="<published title>" PROOF_HIDDEN_BANNER="<paused title>" \
   PROOF_SECTIONS=<first blocks in the new order, comma-separated> PROOF_PRODUCT=<product id> PROOF_TIER=<minQty>:<discountValue> \
   npm run proof:desk
   ```

   It exits 0 when the phone would see that banner and not the paused one, the home blocks start in that order, and the product carries that tier. Otherwise it lists what differs.
3. Sign in as a Merchandiser and confirm no delete or reset control appears.

**Local rehearsal, 23 Oct 2026** (no staging API exists yet). Run against the local API on the current `develop` code:

- **Desk changes in the portal:** a test banner published, a second published then paused, the product rail moved above the category grid, and 500+ at 20% added on the 9W LED Bulb (product 5).
- **Passing run:** `PROOF_API=http://localhost:5099 PROOF_BANNER="P11 proof banner" PROOF_HIDDEN_BANNER="P11 paused banner" PROOF_SECTIONS=hero_carousel,product_rail,category_grid PROOF_PRODUCT=5 PROOF_TIER=500:20 npm run proof:desk` exited 0.
- **Failing run:** with a paused banner, the old order and a wrong discount, it exited 1 and listed all three differences.
- **Merchandiser check:** a temporary store login with the Merchandiser role signed in and changed its temporary password. It saw no Roles & access or Developer tools. On Products, Categories, Bulk pricing, Campaign banners, Home screen sections, Delivery pincodes, Stores & groups and Orders there was no delete, remove, reset or deactivate control. Edit controls were there where the role allows editing.
- **Undone afterwards:** both test banners deleted, the home order and the bulk prices back as before (checked on the public API), and the test login switched off and then deleted by email.

The staging run itself is still to do once a staging API exists.

`npm test` in `server/` runs the unit tests for banner windows, homepage blocks, stock split, banner upload, and this check.

### P10 note

`POST /cms/banners/media` accepts one JPEG, PNG, or WebP up to 2 MB, checks the file bytes rather than the browser’s type label, and stores `/uploads/banners/…`. Saving the banner keeps that path. The API serves the file. The phone loads `/uploads/…` from the API origin, not from the website asset host. A pasted CDN URL still works. Set `PUBLIC_API_ORIGIN` when banner responses should rewrite that path to an absolute URL.

### P9 note

Saving a product writes `product_pricing.SellingPrice` for every active price row. If the product has none, one row is inserted, so the catalogue price is no longer the ₹450 fallback. Stock is the sum of `inventory_stock` for that product: existing rows are resized to the typed total, and a product with no inventory row gets one. `PUT /pricing/bulk-tiers/:id` updates that tier in place. The desk has Edit on each tier.

### P8 note

`GET /cms/home` is the category shortcut row and the Shop by project tiles. It starts empty. Staff with Home screen sections access edit it on Shortcuts & projects. Saving replaces the whole page, and every category must still be on sale. The phone adds its own More tile; the row holds at most 7.

Anonymous `GET /cms/sections` returns the enabled phone blocks in desk order: category shortcuts, hero, trust strip, shop by project, order again, offer tiles, product rail, quick tools. Stored rows are mapped onto those blocks (`hero_banners` is the hero, `popular_categories` is shop by project, `best_sellers` is the product rail). A row the phone cannot draw, such as `product_deal_slider`, is left out of both lists. Staff see the same blocks with the hidden ones included. Missing blocks are inserted once; reset restores this order and turns them all on. `informational_strip` stays off the desk until the app has a block for it.

### P7 note

Anonymous `GET /cms/banners` ignores `?status=` and returns only campaigns that are live right now: `published` inside its window (empty dates stay live), or `scheduled` with a start and still inside the window. `paused`, `draft`, and `archived` stay off the phone. Staff still see every status, including `startsAt` and `endsAt`. A status-only save does not wipe the window.

### P6 ops note
- `GET /catalog/products?page=&limit=&search=&categoryId=` returns `{ data, meta: { total, page, limit, totalPages } }`.
- Portal Products desk queries that endpoint per page (default 50). Dashboard KPI uses `meta.total`.
- Ensure `techxpertstore.portal_audit_logs` exists (see `server/sql/portal_audit_logs.sql`) so Audit Trail does not 503.

### P3 ops note
Create the MySQL table once (see `docs/DATABASE_SCHEMA.md` → `portal_audit_logs`). If MySQL is down, audit reads/writes return 503 unless `ALLOW_FILE_STORE=1` (local only), which uses `server/database.json`.

### P4 ops note
If `portal_audit_logs.entity` was created before P4, add the enum value:  
`ALTER TABLE techxpertstore.portal_audit_logs MODIFY entity ENUM('banner','section','bulk_tier','product','publish','order','category') NOT NULL;`

### P5 ops note
- Login: `POST /auth/admin/login` against the store's staff list `techxpertstore.portal_staff`: a store login, or a Homecare login that has been linked (A3, [PORTAL_ACCESS.md](./PORTAL_ACCESS.md)). Unlinked Homecare logins are refused. Rate-limited (10 / 15 min / IP+email).
- Local seed: **opt-in** `ALLOW_DEV_ADMIN=1` + `admin@techxpert.in` / `admin123`. Always off in production.
- Production **requires** `JWT_SECRET` (≥24 chars) and `CORS_ORIGINS` (comma allowlist) or the API refuses to start.
- Every admin request re-checks the staff row (and, for linked people, the Homecare login's `is_active`), and refuses tokens issued before the last password change.
- Portal: `VITE_API_BASE_URL` (default `http://localhost:5001`); session via HttpOnly cookie `tx_admin_token` (`credentials: 'include'`); profile cache in `localStorage`.
- Public `GET /cms/banners` defaults to **published** only; admin session sees all statuses.
- Staff mutations + sensitive reads require admin plus the module permission from the store role (A1, [PORTAL_ACCESS.md](./PORTAL_ACCESS.md)); `GET /orders/:id` owner or staff with Orders view.
- Dual-DB: customer login → `homecare` (`userPool`); staff login → `techxpertstore.portal_staff` (`storePool`), reading `homecare.admin_users` only for linked people; catalog/orders/CMS → `techxpertstore` (`storePool`). See `GET /health` → `db`. File-store fallback only with `ALLOW_FILE_STORE=1`.
- Staff accounts (A3): `server/sql/portal_staff.sql`, then `npm run staff:bootstrap` for the first super admin, then deploy API and portal together. Temporary passwords are shown once in the portal; until changed, every admin call except `/auth/admin/me` and `/auth/admin/password` answers 403 `PASSWORD_CHANGE_REQUIRED`. Rollout, rollback and lock-out recovery: [PORTAL_ACCESS.md](./PORTAL_ACCESS.md) §A3.

### Hardening tranche (H1–H4 + Medium M1/M2/M5/M8/M9)
See [`docs/WEB_PORTAL_AUDIT.md`](./WEB_PORTAL_AUDIT.md) — implemented.
