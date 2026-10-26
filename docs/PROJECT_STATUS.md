# Techxpert Store — status and audit index

As of **24 Oct 2026**. One page that says what was built, why, by which files, and what comes next. Detail lives in the linked docs; this file points to them.

**State of the repo:** pushed to GitHub as four commits on top of `1df128a` (`feef46e` server, `8092aa6` portal, `68923f1` phone app, `d698a52` docs), which are on both `main` and `develop`. From here all work is committed on **`develop`**; `main` moves only when asked. All database proof was run against the **local** MySQL (`homecare` + `techxpertstore` on localhost), not production.

---

## 1. Vision

- **Customer phone app** (`app/`, Expo) for construction and home materials: browse, cart, deliver-to-pincode, cash-on-delivery order.
- **Merchandising portal** (`web/`, Vite React) so staff run the catalogue, homepage, banners, bulk pricing, delivery areas and orders **without a developer or an app release**.
- **One API** (`server/`, Express + MySQL) that is the single source of truth: it decides prices, owns the cart, says where we deliver, writes the order, and decides who on staff may do what.
- **Two schemas on one MySQL host:** `homecare` (identity, shared with the Homecare product — logins, customers, addresses; its schema is never changed from here) and `techxpertstore` (catalogue, carts, orders, CMS, pincodes, stores, portal roles).
- **Out of scope for the original shop:** a customer website, ERP, Homecare code. The launch plan in [`STORE_PLAN.md`](./STORE_PLAN.md) moves images, a GST invoice, large-order confirmation and staff-created orders onto the launch list. Payment, returns and a full inventory ledger stay later.

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
| Portal access A3 | Store-owned staff list: store logins, plus linked Homecare logins for people in both; Homecare logins no longer listed | **Done** on `develop` (server, portal, docs), proven on the local DB and in the browser; a linked sign-in with a real Homecare password is still to try. Production: back up the staff role and scope tables, run `portal_staff.sql`, `npm run staff:bootstrap`, then deploy API and portal together | [`PORTAL_ACCESS.md` §A3](./PORTAL_ACCESS.md) |

### Staff hierarchy (A1 + A2)

Two independent answers decide what a staff member gets: **what they may do** (role, A1) and **where** (scope, A2).

**Who — the staff list (A3, built).** The store keeps its own staff list. A person is either a store login or a linked Homecare login, for someone who works in both and keeps one password. Homecare people who aren't linked never appear and can't sign in. Super admin is a flag on the store's list, created with `npm run staff:bootstrap`; Homecare's `super_admin` role no longer counts.

**What — roles (built).** Super admin has everything and is never given a store role. Everyone else gets one store role, created in the portal, with View / Edit / Delete per module (products, categories, pricing, banners, sections, orders, delivery, stores, customers, audit, access). Edit or Delete implies View. Nobody can grant more than they hold, edit their own role, change themselves, or change someone who holds more. The A1 roles copied from Homecare roles were removed in A3.

**Where — stores and groups (built).**

- Each pincode belongs to exactly one store; a store serves many pincodes.
- Above stores is a free tree the company builds itself: groups named Zone, Area, Cluster… at any depth; stores and groups can be moved.
- A staff member's scope is one or more places in that tree, or the whole company. A place covers everything under it, including stores added later.
- Example: Store A (pincodes set 1) and Store B (pincodes set 2) can have different managers (each scoped to their store) or one manager (scoped to both); an area manager is scoped to the group containing both and sees everything in it.
- You can only give scope inside your own; only whole-company staff can give whole company. Existing staff started as whole company; someone with a role but no places sees no orders, pincodes or customers.
- An order to a pincode that no active store serves is refused.
- Scope filters orders (by the store recorded at checkout), delivery pincodes, and customers who ordered from those stores. Catalogue, banners, sections and pricing stay company-wide.
- A store with no quantity of its own sells the company figure on the variant. Staff can set a quantity for a store on the product screen; that store then sells only that quantity, and the stores together cannot hold more than the company figure. The phone still shows the company figure until checkout, which uses the store that serves the pincode.

Full decisions, tables and the as-built API: [`PORTAL_ACCESS.md`](./PORTAL_ACCESS.md) (§A2 "As built").

---

## 4. Core logic and the file responsible

What an auditor should check, where it lives.

### Money, stock, cart, order

| Rule | Where |
|---|---|
| Unit price = lowest active `product_pricing.SellingPrice`; none → product not orderable (no ₹450 fallback) | `server/src/utils/cartRules.ts` (`priceLine`), `server/src/services/cartService.ts` (`priceRows`), `server/src/services/catalogService.ts` |
| Bulk tier applied on top of base price: of the tiers covering the quantity, the one giving the lowest unit price (percent off, or a fixed unit price); a tier that wouldn't lower the price is ignored. `GET /pricing/calculate` uses the product's own price, never one sent by the caller | `server/src/utils/bulkPricing.ts`, `server/src/services/pricingService.ts`, `cartRules.priceLine` |
| Order status is one of pending, confirmed, processing, shipped, delivered, cancelled; anything else is refused | `server/src/utils/validate.ts` (`validateOrderStatusBody`), `server/src/routes/orders.ts` |
| Order Again is the products this customer bought (cancelled orders left out), one row each, at today's price and stock. A product that can't be bought stays, with a reason. Unsigned and staff tokens get 401 | `server/src/utils/orderRules.ts` (`orderAgainItem`), `orderService.getOrderAgain`, `GET /orders/again` |
| Reorder adds one of the customer's orders on top of their cart, at today's price and limits, and names every line it could not add. It does not place an order. Another customer's order is 404 | `cartRules.reorderTarget`, `cartService.reorder`, `POST /cart/reorder` |
| Saved items follow the account (a guest list follows `x-session-id`). Today's price and stock. Merge on sign-in keeps the device list, then the guest list, then the account, capped at 100. A product that can't be bought stays, with a reason | `wishlist.ts`, `wishlistService.ts`, `GET/PUT /wishlist`, `POST /wishlist/merge`, `sql/saved_items.sql` |
| Help page is the phone, WhatsApp, email, hours and questions the app will show. Empty until staff fill it in. Replacing it needs Help & support edit | `helpContent.ts`, `helpService.ts`, `GET/PUT /cms/help`, `HelpManager.tsx`, `sql/help_content.sql` |
| Home shortcuts and projects are the category row and project tiles. Empty until staff pick categories that are on sale. Replacing the page needs Home screen sections edit. The app adds More; this list holds at most 7 | `homeMerch.ts`, `homeMerchService.ts`, `GET/PUT /cms/home`, `HomeMerchManager.tsx`, `sql/home_merch.sql` |
| Search ideas are the chips under the home search box. Empty until staff type them. Replacing the list needs Home screen sections edit. Eight ideas, 40 characters each. A save that leaves the list out is refused; an empty list clears it | `searchSuggestions.ts`, `searchSuggestionService.ts`, `GET/PUT /cms/search-suggestions`, `SearchIdeasManager.tsx`, `sql/search_suggestions.sql` |
| Trust strip claims are the four tiles under the banners. Empty until staff write them. Replacing them needs Home screen sections edit. A claim is words, one of four symbols, and a tap that opens delivery, about, help, or a phone call. A save that leaves the list out is refused; an empty list clears it | `trustClaims.ts`, `trustClaimService.ts`, `GET/PUT /cms/trust`, `TrustStripManager.tsx`, `sql/trust_claims.sql` |
| About the company is the mission, facts and values on About us. Empty until staff write them. Replacing the page needs About the company edit. Four facts and six values. An empty body clears the page | `aboutPage.ts`, `aboutService.ts`, `GET/PUT /cms/about`, `AboutManager.tsx`, `sql/about_page.sql` |
| Policies are privacy, terms, cancellation and shipping. Empty until staff paste the published text. Replacing one page needs Policies edit. Leaving a list out is refused; empty lists clear that page only | `policies.ts`, `policyService.ts`, `GET /cms/policies`, `PUT /cms/policies/:id`, `PoliciesManager.tsx`, `sql/policies.sql` |
| Deals tiles are the two cards under Deals for You. Empty until staff pick categories that are on sale. Replacing the row needs Home screen sections edit. A save that leaves the list out is refused; an empty list clears it. A tile is a title, an optional second line, a tagline, peach or navy, and an optional picture. There is no discount on the tile | `deals.ts`, `dealService.ts`, `GET/PUT /cms/deals`, `DealsManager.tsx`, `sql/home_deals.sql` |
| Cancelling: cancelled is final (409 on any change); a delivered order can't be cancelled (409). Cancelling an order placed through this shop (`TX-ORD-`) puts each line's quantity back on the variant it took from, in the same transaction, resizes that variant's inventory rows and marks an out-of-stock product in stock. If that order's store had its own quantity, the same amount goes back on that store row. Imported orders (`ORD-`) put nothing back. The history note says which | `server/src/utils/orderRules.ts`, `orderService.updateOrderStatus` / `putStockBack`, `web/src/services/orderStatus.ts` (`statusChoices`, `restocksOnCancel`), `web/src/components/OrdersManager.tsx` |
| Product edit: left-out fields stay; `price: null` takes it off sale (price rows switched off, kept on record); empty brand clears it | `validate.ts` (`validateProductUpdateBody`), `catalogService.updateProduct`, `web/src/components/CatalogOverview.tsx` |
| GST, the delivery fee and free delivery. Defaults are 18%, ₹99, and free from ₹2,000. Staff change them on Shop settings. A switched-off rule does not apply. At or above a switched-on large-order value or quantity, a customer order is pending and holds its stock. Cash above a switched-on limit is refused. A staff-placed order is confirmed and is not refused for cash | `shopSettings.ts`, `shopSettingsService.ts`, `cartRules.cartTotals`, `GET /shop/rules`, `SettingsManager.tsx`, `sql/shop_settings.sql` |
| Staff place an order for a customer. It is confirmed at once and takes stock. The tag is `staff`, or `request` when it closes a Talk to us request. An order the customer placed is `app` | `staffOrder.ts`, `staffOrderService.ts`, `POST /orders/staff`, `PlaceOrderDialog.tsx`, `sql/order_source.sql` |
| Staff agree a delivery charge or a line price on a pending order, or on an order they placed that is still confirmed. Tax is worked out again. Stock is unchanged. The Agreed price permission is separate from changing the status | `agreedPrice.ts`, `agreedPriceService.ts`, `PUT /orders/:id/price`, `OrdersManager.tsx` |
| A customer order or a Talk to us request shows in the portal until staff mark it seen. An order staff place themselves does not. The alert has no phone number and no customer name | `staffAlert.ts`, `staffAlertService.ts`, `GET/PUT /shop/alerts`, `sql/staff_alerts.sql`, `ArrivedList.tsx` |
| Order confirmation starts off. Staff choose a text message or WhatsApp. The customer is told the order number and the total once the order is confirmed. The phone number is not stored. A missing template is written on the order and the order still stands | `orderNotice.ts`, `orderNoticeService.ts`, `POST /orders/:id/confirmation`, `sql/order_messages.sql`, `SettingsManager.tsx` |
| A stock edit needs a reason: received, counted, or damaged. It is written on the audit trail. The same quantities need no reason, and a missing reason changes nothing | `stockReason.ts`, `catalogService.updateProduct`, `CatalogOverview.tsx` |
| Quantity limits and the refusal sentence. A pack size of 1 means any whole number from the minimum. A larger pack size means that size, then twice that, and so on, starting at the higher of the minimum and the pack size | `cartRules.quantityRefusal`, `products.QuantityStep`, `sql/quantity_step.sql`, `CatalogOverview.tsx` |
| Per-store stock. No row means that store sells the company figure. A row is only what that store can sell, and never more than the company figure. The rows for one option cannot add up to more than that figure. Checkout for the pincode's store uses the row when it exists, and puts it back on cancel. The product page and the cart, before a pincode is known, stay on the company figure | `storeStock.ts`, `storeStockService.ts`, `sql/store_variant_stock.sql`, `CatalogOverview.tsx` |
| A cart call with no `variantId` sells the first variant. A call that names one sells that option: its stock, its price when it has one, and checkout takes that stock back. The product page lists every option. The portal edits each option's stock | `variants.ts`, `catalogService.ts` (`variants`, `writeChosenStocks`), `cartService.setLineQuantity`, `orderService.getOrderAgain`, `CatalogOverview.tsx` |
| Product page highlights and specifications start empty. Staff fill them on the product screen. A save that leaves a list out does not clear it; an empty list does | `productPage.ts`, `catalogService.ts` (`readProductPage`, `writeProductPage`), `CatalogOverview.tsx`, `sql/product_page.sql` |
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
| Roles & Access screen (roles, staff role, staff places; add, link, manage staff) | `web/src/components/AccessManager.tsx`, `web/src/components/StaffAccounts.tsx` |
| First-sign-in and Change password screens | `web/src/components/ChangePassword.tsx`, `web/src/App.tsx` |
| Places: group tree, whole-company switch, scoped orders / pincodes / customers (404 outside), scope no-escalation | `server/src/utils/scope.ts`, `accessService.ts` (`forStaff`, `setStaffScope`), `orderService.ts`, `deliveryAreaService.ts`, `authService.getAllUsers` |
| Stores & Groups (tree, stores, pincode links) | `server/src/services/storeTreeService.ts`, `server/src/routes/stores.ts`, `web/src/components/StoreTreeManager.tsx` |
| Store on each order; refuse pincodes no active store serves | `deliveryAreaService.assertServiceable`, `cartCheckoutService.ts`, `orderService.writeOrder` |

### Tests

`cd server && npm test` — 223 unit tests, including `security`, `wishlist`, `helpContent`, `homeMerch`, `searchSuggestions`, `trustClaims`, `aboutPage`, `policies`, `deals`, `variants`, `productPage`, `cartRules`, `bulkPricing`, `orderRules`, `validate`, `checkoutPricing`, `permissions`, `scope`, `pincode`, `bannerEligibility`, `bannerMedia`, `stockAllocation`, `storeStock`, `shopSettings`, `talkRequest`, `staffOrder`, `agreedPrice`, `staffAlert`, `orderNotice`, `stockReason`, `deskAccess` (`server/src/utils/*.test.ts`). `npm run proof:desk` (`server/src/scripts/deskProof.ts`) checks a staging API from the outside.

---

## 5. Database changes

Run in this order on production (all applied to the local DB already). See [`server/sql/README.md`](../server/sql/README.md), and [`ROLLOUT.md`](./ROLLOUT.md) for the full production checklist with checks and rollback.

1. `server/sql/portal_audit_logs.sql`
2. `server/sql/portal_audit_logs_alter_category.sql` (only if the table predates the newer entities)
3. `server/sql/shop_s3_checkout.sql`
4. `server/sql/portal_access.sql`
5. `server/sql/portal_scope.sql`: before restarting the API on the A2 code. With more than one store, link every active pincode to a store first, or it stops.
6. `server/sql/portal_staff.sql`: before restarting the API on the A3 code. Back up `portal_staff_roles` and `portal_staff_scope` first; it empties them and has no undo.
7. `npm run staff:bootstrap` once, for the first super admin. Then deploy the API and portal together.
8. `server/sql/saved_items.sql`: the customer wishlist. Safe to run again. The previous API ignores the table.
9. `server/sql/help_content.sql`: the help page (empty until staff fill it) and the `help` audit label. Safe to run again. Comes after the audit table exists.
10. `server/sql/home_merch.sql`: the home shortcut row and project tiles. Starts empty. Safe to run again.
11. `server/sql/product_page.sql`: highlights and specifications on the product page. Starts empty. Safe to run again. The previous API ignores the tables.
12. `server/sql/search_suggestions.sql`: the home search ideas. Starts empty. Safe to run again. The previous API ignores the table.
13. `server/sql/trust_claims.sql`: the home trust-strip claims. Starts empty. Safe to run again. The previous API ignores the table.
14. `server/sql/about_page.sql`: the About page (mission, facts, values) and the `about` audit label. Starts empty. Safe to run again. Comes after the audit table exists. The previous API ignores the tables.
15. `server/sql/policies.sql`: privacy, terms, cancellation and shipping, and the `policy` audit label. Starts empty. Safe to run again. Comes after the audit table exists. The previous API ignores the tables.
16. `server/sql/home_deals.sql`: the deals-for-you tiles. Starts empty. Safe to run again. The previous API ignores the table.
17. `server/sql/quantity_step.sql`: pack size on each product. Existing products stay at 1, which is any whole number from the minimum. Safe to run again.

Schema reference: [`DATABASE_SCHEMA.md`](./DATABASE_SCHEMA.md).

---

## 6. Plan of action

| # | Item | Who / where | Done when |
|---|---|---|---|
| 1 | Restart the API on :5001 on the new code (portal needs `/me` permissions) | ops | **Done** locally (restarted 23 Oct 11:52; `/api/access/*` answers) |
| 2 | Device run of shop S1–S3 | **app team** (outside this track); `app/` screens Cart, Checkout | guest cart, merge, pincode, order, repeat-tap all behave as in `SHOP_TRACK.md` |
| 3 | P11 staging desk proof | `server/src/scripts/deskProof.ts`, `WEB_SPEC.md` P11 note | `npm run proof:desk` exits 0. **Rehearsed locally 23 Oct:** exits 0 after real desk changes, 1 when they differ; Merchandiser sees no delete or reset control. The staging run waits for a staging API |
| 4 | **A2 detailed design**, agreed before build | `docs/PORTAL_ACCESS.md` §A2 (design + review R1–R9) | **Done** — D1–D4 answered 23 Oct |
| 5 | A2 build: pincode → store, group tree, staff scope, store on each order, scoped orders / pincodes / customers | `server/sql/portal_scope.sql`, `scope.ts`, `storeTreeService.ts`, `routes/stores.ts`, `accessService.ts`, `deliveryAreaService.ts`, `orderService.ts`, `StoreTreeManager.tsx`, `AccessManager.tsx` | **Done** on `develop` 23 Oct: 71/71 unit tests, 61/61 HTTP checks, browser check; local API on :5001 needs a restart to run it |
| 6 | Portal UI/UX pass: truth and wording (U1), shared building blocks (U2), screens in batches (U3–U6) | [`PORTAL_UI_PASS.md`](./PORTAL_UI_PASS.md); `web/src/components/*` | U1 done 23 Oct, with toasts, light theme in the logo colours and the logo fix; U2 done 23 Oct (shared pieces; Delivery Pincodes and Roles & Access moved onto them); U3 done 23 Oct (Orders, Customers, Dashboard); U4 done 23 Oct (Products, Categories, Bulk Pricing; adding categories and subcategories fixed on the server); U5 done 23 Oct (Campaign Banners, Homepage Sections); U6 done 23 Oct (Stores & groups, Audit trail, Sign-in, Developer tools, sidebar, header). **Done** |
| 7 | Production rollout | [`ROLLOUT.md`](./ROLLOUT.md): SQL, settings, API and portal together, phone build, checks, rollback | Checklist written 23 Oct; waits for someone with production access |
| 8 | Server gaps from the UI pass: order status, `/pricing/calculate` price, bulk tier picking, clearing a product's brand or price | `bulkPricing.ts`, `validate.ts`, `pricingService.ts`, `routes/orders.ts`, `routes/pricing.ts`, `catalogService.updateProduct`, `CatalogOverview.tsx` | **Done** 23 Oct: 99/99 unit tests, HTTP checks, browser check (remove-price confirm) |
| 9 | Cancelling puts stock back. Decided 23 Oct: delivered orders can't be cancelled, cancelled is final, imported orders put nothing back | `orderRules.ts`, `orderService.ts`, `OrdersManager.tsx`, `orderStatus.ts`, `App.tsx` | **Done** 23 Oct: 104/104 unit tests. A test guest order took 1 + 2 units, and cancelling it put them back exactly (68 and 500 again); reopening, cancelling twice and cancelling delivered order 1 were refused without touching stock. Browser: cancelled order locked, delivered order has no Cancel, confirm wording for shop vs imported orders |
| 10 | Customer API holes found while writing the app guide: `GET /orders` without a sign-in listed every customer's orders; `POST /auth/login` gave a customer token with no code; code `123456` worked in production | `config/security.ts`, `authService.ts`, `routes/auth.ts`, `routes/orders.ts`; guide [`APP_API_GUIDE.md`](./APP_API_GUIDE.md) | **Done** 23 Oct: 107/107 unit tests. Local: anonymous and staff-without-`all` get 401, a customer sees only their own orders. Production mode: `/auth/login` 403, `123456` refused, anonymous orders 401 |
| 11 | Order Again for the app: one call for the products a customer bought, at today's price and stock | `orderRules.ts`, `orderService.getOrderAgain`, `GET /orders/again`, [`APP_API_GUIDE.md`](./APP_API_GUIDE.md) UC-1 | **Done** 24 Oct: 113/113 unit tests. Local: unsigned and staff get 401; a customer with 9 bought products got those 9, unique, today's price matching the catalogue (₹1,999); a product with stock but no price came back `available: false`; `limit=1` and the cap at 20 held |
| 12 | Reorder: put one past order back into the cart at today's prices, and say which lines were skipped | `cartRules.ts` (`reorderTarget`), `cartService.reorder`, `POST /cart/reorder`, [`APP_API_GUIDE.md`](./APP_API_GUIDE.md) UC-11 | **Done** 24 Oct: 118/118 unit tests. Local: unsigned and staff get 401; a bad id is 400; someone else's order is 404. Order 1 added the 9W LED Bulb (3, today's price) and skipped the removed air conditioner. The cart was put back afterwards |
| 13 | Saved items on the server, merged into the account on sign-in | `sql/saved_items.sql`, `wishlist.ts`, `wishlistService.ts`, `routes/wishlist.ts`, [`APP_API_GUIDE.md`](./APP_API_GUIDE.md) UC-12 | **Done** 24 Oct: 124/124 unit tests. Local: guest save, a removed product refused, merge order device then guest then account, an unpriced product stayed unavailable, guest list cleared, rows removed afterwards |
| 14 | Help & support structure: phone, WhatsApp, email, hours and questions, empty until staff fill them | `sql/help_content.sql`, `helpService.ts`, `GET/PUT /cms/help`, `HelpManager.tsx`, [`APP_API_GUIDE.md`](./APP_API_GUIDE.md) UC-13 | **Done** 24 Oct: 128/128 unit tests. The page starts blank. A new Help & support module; super admin sees it, other roles see it once it is ticked on their role |
| 15 | Home shortcuts and projects: staff pick real categories for the home row and the project tiles | `sql/home_merch.sql`, `homeMerchService.ts`, `GET/PUT /cms/home`, `HomeMerchManager.tsx`, [`APP_API_GUIDE.md`](./APP_API_GUIDE.md) UC-14 | **Done** 24 Oct: 132/132 unit tests. Both lists start empty. Same access as Home screen sections. The app still uses its own lists until it reads the new call |
| 16 | Sell the chosen variant: product detail lists options, the cart and reorder keep that option, the portal edits each option's stock. No `variantId` still sells the first | `variants.ts`, `catalogService.ts`, `cartService.ts`, `orderService.getOrderAgain`, `CatalogOverview.tsx`, [`APP_API_GUIDE.md`](./APP_API_GUIDE.md) UC-4 and UC-6 | **Done** 24 Oct: 138/138 unit tests. Guest cart: Brown (variant 4) at ₹1,999 with stock 60, then White (first option) at its own ₹199 with stock 68, both kept; a variant from another product was refused; the cart was emptied and stock was unchanged. Portal: the fan row says "3 options" and the bulb "2 options". Editing Brown 60→61 left White at 68 and Black at 50, then Brown was put back to 60 |
| 17 | Product page highlights and specifications, empty until staff fill them | `sql/product_page.sql`, `productPage.ts`, `catalogService.ts`, `CatalogOverview.tsx`, [`APP_API_GUIDE.md`](./APP_API_GUIDE.md) UC-4 | **Done** 24 Oct: 142/142 unit tests. A product with nothing filled returns empty lists. Saving Remote control and Sweep / 48 inch on the ceiling fan kept stock at 68, 60 and 50; a later save that did not mention the lists left them; clearing them put the page back to empty. Portal: Add highlight and Add specification, then Remove, on the product screen |
| 18 | Home search ideas, empty until staff fill them | `sql/search_suggestions.sql`, `searchSuggestions.ts`, `searchSuggestionService.ts`, `SearchIdeasManager.tsx`, [`APP_API_GUIDE.md`](./APP_API_GUIDE.md) UC-15 | **Done** 24 Oct: 146/146 unit tests. The list starts empty. Saving LED bulbs left the shortcut row and project tiles empty; a save that left the list out was refused and the idea stayed; a repeated idea was refused; clearing the list put it back to empty. Unsigned saves are 401. Portal: Add idea, Save, then Remove, on Shortcuts & projects |
| 19 | Trust strip claims, empty until staff fill them | `sql/trust_claims.sql`, `trustClaims.ts`, `trustClaimService.ts`, `TrustStripManager.tsx`, [`APP_API_GUIDE.md`](./APP_API_GUIDE.md) UC-16 | **Done** 24 Oct: 150/150 unit tests. The list starts empty. Saving Fast Delivery, a delivery van, opening the delivery location, left the eight home blocks shown; a save that left the list out was refused and the claim stayed; a repeated claim and an unknown symbol were refused; clearing the list put it back to empty. Unsigned saves are 401. Portal: Add claim, Save, then Remove, on Home screen sections |
| 20 | About the company, empty until staff fill it | `sql/about_page.sql`, `aboutPage.ts`, `aboutService.ts`, `AboutManager.tsx`, [`APP_API_GUIDE.md`](./APP_API_GUIDE.md) UC-17 | **Done** 24 Oct: 154/154 unit tests. The page starts empty. Saving a mission, the fact 2017 Founded and the value Excellence left the eight home blocks shown; a half-filled fact and an unknown symbol were refused and the page stayed; clearing the page put it back to empty. Unsigned saves are 401. Portal: Add fact, Add value, Save, then Remove, on About the company. Dashboard still Orders 5, Customers 7, Products 1,10,106 |
| 21 | Policies, empty until staff paste the published text | `sql/policies.sql`, `policies.ts`, `policyService.ts`, `PoliciesManager.tsx`, [`APP_API_GUIDE.md`](./APP_API_GUIDE.md) UC-18 | **Done** 24 Oct: 158/158 unit tests. All four pages start empty. Saving cancellation with a date, a website link, an opening paragraph and one section left privacy, terms and shipping empty; a save that left the lists out was refused and the page stayed; a heading with no name and a link that was not a web address were refused; clearing the lists put cancellation back to empty. Unsigned saves are 401. Portal: Add paragraph, Add section, Save, then Remove, on Policies. Dashboard still Orders 5, Customers 7, Products 1,10,106 |
| 22 | Deals tiles, empty until staff pick categories | `sql/home_deals.sql`, `deals.ts`, `dealService.ts`, `DealsManager.tsx`, [`APP_API_GUIDE.md`](./APP_API_GUIDE.md) UC-19 | **Done** 24 Oct: 162/162 unit tests. The row starts empty. Saving Electrical Appliances as Desk tile, peach, with a tagline and no picture left the shortcut row and project tiles empty; a save that left the list out was refused; a category that is not on sale and an unknown colour were refused; clearing the list put the row back to empty. Unsigned saves are 401. Portal: Add tile, Save, then Remove, on Shortcuts & projects. Dashboard still Orders 5, Customers 7, Products 1,10,106, and 8 of 8 home sections |
| 23 | Sold in multiples | `sql/quantity_step.sql`, `cartRules.ts`, `catalogService.ts`, `CatalogOverview.tsx`, [`APP_API_GUIDE.md`](./APP_API_GUIDE.md) UC-4 and UC-6 | **Done** 24 Oct: 167/167 unit tests. Every product starts at 1, which is any whole number from the minimum. Setting the ceiling fan to 6 left stock at 68, 60 and 50; a quantity of 1 and 7 was refused; 6 was accepted with `limits.step` 6; a save that left the pack size out kept 6; putting it back to 1 restored the old rule. Portal: Sold in multiples of, on the product screen |
| 24 | Per-store stock | `sql/store_variant_stock.sql`, `storeStock.ts`, `storeStockService.ts`, `CatalogOverview.tsx`, [`APP_API_GUIDE.md`](./APP_API_GUIDE.md) UC-4 and UC-10 | **Done** 24 Oct: 172/172 unit tests. A store with no row sells the company figure. Setting the one open store to 10 on White left company stock at 68, 60 and 50 and the pack size at 1. 100 was refused. A save that left store stock out kept 10. Lowering White to 5 while the store held 10 was refused. Clearing the field removed the row. The public product stayed at 68. A rolled-back take of 4 left the store at 6, and putting it back restored 10, with no row left behind. Portal: Stock at the store, under each option. Dashboard still Orders 5, Customers 7, Products 1,10,106, 8 of 8 home sections, banners 2 live now and 3 in all, bulk pricing 5 |
| 25 | Shop settings | `sql/shop_settings.sql`, `shopSettings.ts`, `shopSettingsService.ts`, `SettingsManager.tsx`, [`STORE_PLAN.md`](./STORE_PLAN.md), [`APP_API_GUIDE.md`](./APP_API_GUIDE.md) | **Done** 24 Oct: 183/183 unit tests. Public rules start at delivery ₹99, free from ₹2,000, GST 18%, with the three large-order lines off. A save that left a rule out was refused and nothing changed. Setting the fee to ₹40 changed the public rules; putting it back restored ₹99. Portal: Shop settings, under Admin. Fan stock stayed 68, 60 and 50, pack size 1, and no per-store row. Dashboard still Orders 5, Customers 7, Products 1,10,106, 8 of 8 home sections, banners 2 live now and 3 in all, bulk pricing 5 |
| 26 | Large-order checkout | `checkoutPlacement` in `shopSettings.ts`, `orderService.ts`, `cartCheckoutService.ts`, `OrdersManager.tsx`, [`APP_API_GUIDE.md`](./APP_API_GUIDE.md) | **Done** 24 Oct: 189/189 unit tests. Thresholds stay off, so an ordinary order is still confirmed. At or above a switched-on value or quantity, the order is pending and holds its stock; cancel puts it back. Cash above a switched-on limit is refused and nothing is ordered. A rolled-back pending take moved White from 68 to 67 and the rollback left 68, 60 and 50, pack size 1, and no per-store row. A cash limit of ₹1 refused the fan at ₹333.82, then the limit was switched off again |
| 27 | Talk to us | `sql/talk_requests.sql`, `talkRequest.ts`, `talkRequestService.ts`, `RequestsManager.tsx`, [`APP_API_GUIDE.md`](./APP_API_GUIDE.md) UC-20 | **Done** 24 Oct: 195/195 unit tests. A request for 100 of the ceiling fan was accepted, priced, and noted that only 68 are in stock. Nothing was ordered. Unsigned listing is 401. A missing name, a short quantity and pincode 110001 were refused. Staff closed it from Talk to us. The proof request was then removed. Fan stock stayed 68, 60 and 50, pack size 1, no per-store row. Dashboard still Orders 5, Customers 7, Products 1,10,106, 8 of 8 home sections, banners 2 live now and 3 in all, bulk pricing 5 |
| 28 | Staff-created orders and the source tag | `sql/order_source.sql`, `staffOrder.ts`, `staffOrderService.ts`, `POST /orders/staff`, `PlaceOrderDialog.tsx`, [`APP_API_GUIDE.md`](./APP_API_GUIDE.md) | **Done** 25 Oct: 198/198 unit tests. Unsigned place is 401. A missing address is refused. 100 of the ceiling fan is refused by the shelf limit of 10, and nothing is written. Staff placed one from Orders; it was confirmed and tagged Staff, while older orders stay App. Cancelling put the fan back to 68, 60 and 50. The proof order and the account it created were removed. Pack size 1, no per-store row, Talk to us empty. Dashboard still Orders 5, Customers 7, Products 1,10,106, 8 of 8 home sections, banners 2 live now and 3 in all, bulk pricing 5 |
| 29 | Agreed price | `agreedPrice.ts`, `agreedPriceService.ts`, `PUT /orders/:id/price`, `OrdersManager.tsx` | **Done** 26 Oct: 205/205 unit tests. Unsigned is 401. A confirmed app order was refused and its total stayed ₹2,65,500. On a staff order, delivery ₹99 and a line of ₹199 became delivery ₹0 and a line of ₹100, tax ₹18, total ₹118. Saving the same charge again was refused. The portal saved delivery ₹0 on a staff order and the total became ₹234.82. A confirmed app order shows no Agreed price block. The proof orders were cancelled and removed. Fan stock is 68, 60 and 50, pack size 1, no per-store row. Dashboard still Orders 5, Customers 7 |
| 30 | Staff alerts | `sql/staff_alerts.sql`, `staffAlert.ts`, `staffAlertService.ts`, `GET/PUT /shop/alerts`, `ArrivedList.tsx` | **Done** 26 Oct: 208/208 unit tests. Unsigned listing is 401. A blank seen is refused. A staff-placed order did not alert. A Talk to us request showed "Talk to us" and "Nothing is ordered", with no phone number in the alert. Marking it seen removed it from the list. An order alert written inside a transaction disappeared when that transaction was rolled back. The portal showed New 1, then Seen cleared it. The proof request was removed. Fan stock stayed 68, 60 and 50, pack size 1, no per-store row. Dashboard still Orders 5, Customers 7, and Talk to us has no waiting badge |
| 31 | Order confirmation | `sql/order_messages.sql`, `orderNotice.ts`, `orderNoticeService.ts`, `POST /orders/:id/confirmation`, `SettingsManager.tsx` | **Done** 26 Oct: 219/219 unit tests. Unsigned send is 401. A save that left the choice out was refused and nothing changed. With confirmation set to a text message, a staff order was confirmed and recorded "SMS is not configured." The note had no phone number. Sending again kept that one note. The order did not raise a staff alert. It was cancelled and removed. Fan stock stayed 68, 60 and 50, pack size 1, no per-store row. The portal saved Text message, then Off. Delivery stayed ₹99, free from ₹2,000, GST 18%, thresholds off. Dashboard still Orders 5, Customers 7 |
| 32 | Stock reason | `stockReason.ts`, `catalogService.updateProduct`, `CatalogOverview.tsx` | **Done** 26 Oct: 223/223 unit tests. Unsigned save is 401. Saving the same White quantity needed no reason and left 68. Saving 67 with no reason was refused and stock stayed 68, 60 and 50. An unknown reason was refused. A store quantity with no reason was refused and no per-store row was written. Saving 67 as Counted wrote the audit line with no phone number. The portal blocked Save until Counted was chosen, then saved 67, then put White back to 68. Pack size stayed 1, shelf limit 10, no per-store row. The proof audit lines were removed. Order confirmation stayed off. Dashboard still Orders 5, Customers 7 |

The launch plan, including what is already built and what is still a decision, is [`STORE_PLAN.md`](./STORE_PLAN.md). Payment, returns and refunds, the full inventory ledger, customer push and weight-based delivery stay in Phase 3 until named.

---

## 7. Known gaps and risks

- **Few orderable products:** 110,100 of 110,106 active products have no active price; four priced products (IDs 4, 6, 7, 8) have no variant. Shown honestly as unavailable; merchandisers must add price/variant.
- **Phone sign-in is memory-only:** after an app restart the customer sees the guest cart until signing in again.
- **Choosing an option is for the app:** the server sells the variant a cart call names, and otherwise still the first one. The phone does not send a variant yet, so a customer cannot pick Brown or Cool White until the app does.
- **Pack size on the cart screen:** the product page already reads `quantityStep`. The cart screen still keeps the step it stored on the line, so it stays 1 until the app reads `limits.step`. The server already refuses a quantity that is not a whole pack.
- **Stock on the product page:** the phone still shows the company figure, because it does not send a store. Checkout for a served pincode uses that store's own quantity when staff have set one.
- **Product page points:** highlights and specifications are empty until staff fill them. The phone already reads both lists from product detail.
- **App home, for the app team:**
  - The category shortcuts and project pages are still the app's own lists (`cement-plaster`, `tiling-grouts`…), which are not in this catalogue, so those blocks find nothing until the app reads `GET /cms/home`. The server page starts empty for staff to fill.
  - The search chips are still the app's own list until it reads `GET /cms/search-suggestions`. The server list starts empty for staff to fill.
  - The trust strip is still the app's own four claims until it reads `GET /cms/trust`. The server list starts empty for staff to fill.
  - About us is still the app's own mission, facts and values until it reads `GET /cms/about`. The server page starts empty for staff to fill.
  - Privacy and terms are still the app's own copies, and cancellation and shipping are still blank, until it reads `GET /cms/policies`. The server pages start empty for staff to paste the published text.
  - The deals tiles are still the app's own two cards until it reads `GET /cms/deals`. The server row starts empty for staff to fill.
  - Banner buttons can't open outside links (they show all products).
- **No SMS sender:** `send-otp` makes a code but nothing texts it to the customer. Locally the code is always `123456`; production needs an SMS provider before phone sign-in works.
- **App sign-in must move to codes:** the app calls `POST /auth/login`, which production now refuses. It must use `send-otp` then `verify-otp` ([`APP_API_GUIDE.md`](./APP_API_GUIDE.md) §8 UC-7).
- **App order statuses:** the app expects `placed`, `packed`, `out_for_delivery`, `returned`; the server uses `pending`, `confirmed`, `processing`, `shipped`, `delivered`, `cancelled`.
- **Guest checkout writes to `homecare.users`:** an unregistered 10-digit phone at checkout creates an unverified customer there (S3 decision), so the order follows the phone once that customer signs in. Kept on purpose, confirmed by the owner 23 Oct.
- **Bulk prices on a removed product:** bulk prices 1–3 belong to product 1 (1.5 Ton Split AC), which was removed, so they never apply. The portal marks them; a merchandiser should remove or re-point them.
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
| [`APP_API_GUIDE.md`](./APP_API_GUIDE.md) | For app developers: run the API locally and build every app flow against it |
| [`WEB_SPEC.md`](./WEB_SPEC.md) | Portal modules and P1–P11 plan with notes |
| [`WEB_PORTAL_AUDIT.md`](./WEB_PORTAL_AUDIT.md) | Security findings, fixes, AuthZ matrix |
| [`SHOP_TRACK.md`](./SHOP_TRACK.md) | Shop S0–S3 spec, as-built, proof |
| [`PORTAL_ACCESS.md`](./PORTAL_ACCESS.md) | Roles A1 and scope A2 (both built) |
| [`PORTAL_UI_PASS.md`](./PORTAL_UI_PASS.md) | Portal UI/UX pass: agreed design and phases U1–U6 |
| [`../server/sql/README.md`](../server/sql/README.md) | Migration order |
| [`STORE_PLAN.md`](./STORE_PLAN.md) | Vision, what is built, launch plan, and the open decisions |
| [`ROLLOUT.md`](./ROLLOUT.md) | Production rollout and rollback checklist |
| `PROJECT_STATUS.md` (this file) | Index for audit review |
