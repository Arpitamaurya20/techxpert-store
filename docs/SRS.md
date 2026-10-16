# Techxpert Store — Software Requirements Specification

**Version:** 1.1  
**Date:** 16 October 2026  
**Product:** Techxpert Store — construction and home-materials commerce  
**Clients:** React Native customer app and React admin/content portal  
**Backend:** Node.js + Express  
**Database:** MySQL 8.0 (SQL relational database)

## 1. Purpose

This specification defines the product experience, user workflows, system boundaries, backend capabilities and implementation acceptance criteria for Techxpert Store. It is intended to align the app developer with the backend and portal team.

## 2. Product vision and users

Techxpert Store serves both **homeowners and contractors** buying construction and home materials in India. The experience must balance quick repeat ordering with product discovery and appealing, campaign-led merchandising.

### Primary goals
- Let users choose a delivery location before shopping.
- Make product discovery fast through search, categories, offers and product rails.
- Make repeat purchases easy through Order Again.
- Display regular prices and eligible quantity-based/bulk discounts clearly.
- Allow authorised staff to update banners and homepage merchandising without app releases.
- Keep product availability, prices, discounts and totals consistent across mobile and portal.

## 3. Technology and system architecture

| Layer | Technology | Responsibility |
|---|---|---|
| Customer mobile app | React Native + TypeScript | UI, navigation, local transient state, API integration |
| Admin portal | React + TypeScript | Manage banners, homepage sections, catalogue and approved content |
| Backend API | Node.js + Express | Authentication, validation, business rules, API and authorization |
| Database | MySQL 8.0 | Relational product, inventory, pricing, cart, customer, order and CMS metadata |
| Media | Object/file storage or CDN | Banner and product images; database stores references and metadata |
| API contract | REST/JSON; OpenAPI recommended | Shared integration contract |

### Source-of-truth principles
1. The backend is authoritative for price, discounts, stock, serviceability, cart totals and order state.
2. Mobile app and portal must call the same business APIs for shared rules.
3. The app renders known, app-built components using content/configuration returned by the API.
4. The CMS may configure approved content and supported component types. It must not return executable code or arbitrary native UI.
5. API changes must be versioned and backward compatible where practical.
6. Database schema changes must be delivered through versioned migrations, not manual production-only edits.

## 4. Scope

### In scope
- Delivery location selection at the top of the shopping experience.
- Homepage sections, banners and promotional content controlled by CMS.
- Category browsing, search, product list and product detail.
- Regular product pricing and quantity-based bulk pricing.
- Cart add/update/remove and server-side revalidation.
- Order Again and order history access, subject to authentication.
- Account/profile and Help entry points.
- Admin portal controls for banners and homepage merchandising.
- MySQL data model, API security, validation, logs, analytics hooks and test coverage.

### Out of scope unless separately approved
- SAP/ERP integration; warehouse automation; RFID integration; route tracking.
- Seller/marketplace onboarding; loyalty or financing.
- Payment gateway, refunds, returns, invoices and full checkout/order-placement workflows unless explicitly included in the commercial scope.
- AI recommendations or offline order submission.

## 5. Personas and key use cases

### Homeowner
- Select delivery location.
- Find a material by name or category.
- Understand product unit, current price and delivery availability.
- Add products and view bulk savings where relevant.
- Browse offers and contact support.

### Contractor
- Reorder commonly purchased materials quickly.
- Compare regular price with quantity-based price tiers.
- Understand minimum quantities, pack sizes and applicable offer terms.
- Build or update a cart without repeated navigation.

### Admin/content editor
- Upload/select a campaign image.
- Edit banner title, subtitle, CTA, alt text and offer terms.
- Preview, schedule, publish, pause and reorder content.
- Configure supported homepage sections and visibility.
- See publish status and audit history.

## 6. Information architecture and homepage order

The homepage balances product discovery and repeat purchasing while keeping the first view practical.

1. Compact top area: Techxpert logo (centred if layout remains clear), delivery location selector, cart and account.
2. Search field with clear search affordance.
3. Horizontal category shortcut row: Cement, Tiles, Paints, Plywood, Plumbing, Electrical, Tools, More.
4. Campaign hero carousel: one prominent banner visible at a time, with indicators and optional swipe.
5. Trust/service strip with only verified claims (e.g. delivery, genuine products, bulk pricing, support).
6. Shop by Category grid.
7. Order Again product rail (personalised for signed-in users).
8. Deals for Your Projects / offer tiles.
9. Popular or recommended products rail.
10. Additional optional CMS-configured sections.
11. Fixed bottom navigation: Home, Order Again, Categories, Help.

The homepage may change its content and section order through CMS configuration. The app must not require a new release to reorder or update supported sections.

## 7. Visual and interaction requirements

See `DESIGN_SYSTEM.md` for tokens and reusable components.

- Use the approved Techxpert logo asset; do not recreate the logo using text.
- Prefer a centred logo when it does not compete with delivery location, cart or account controls. If it causes crowding on narrow devices, use a consistent left-aligned fallback.
- Use a compact header and keep search and category access near the top.
- Use one visually prominent hero carousel, then place product rails and offer tiles between other sections.
- Use navy for brand identity and orange for primary actions/offer accents, pending verification against official brand assets.
- Avoid festive ornaments, unnecessary gradients, excessive decoration and inconsistent banner templates.
- Product cards must show product image, name, unit/pack size, current price, availability state and Add/quantity control. Show bulk pricing cue where applicable.
- All interactive elements need loading, success, error, empty and disabled states where relevant.
- Horizontal product/category rails may scroll horizontally; the overall page must not have horizontal overflow.
- Respect iOS safe areas and Android system insets. Keep bottom navigation clear of device gesture areas.

## 8. Functional requirements

### 8.1 Delivery location
- Location selector is available before shopping and visible near the top of the homepage.
- Users can select, change and confirm a delivery location/address using the agreed address flow.
- The selected location is persisted according to the agreed account/guest policy.
- Location changes trigger revalidation of product serviceability, inventory, delivery options, applicable pricing and cart eligibility.
- If location is missing, the app must not imply that location-specific stock or delivery is confirmed.
- API must validate location serviceability; client-side checks are not authoritative.

### 8.2 Search
- Search supports product name, brand, category and SKU/product code where available.
- Debounce requests and ignore stale responses.
- Provide loading, result, no-result, retry and network-error states.
- Search terms must be safely encoded and validated by the backend.
- Search suggestions are optional until confirmed in scope.

### 8.3 Categories and product browsing
- Category shortcut row and grid are API/CMS driven.
- Categories have stable IDs, labels, icons/images, sort order and active state.
- Product lists support pagination and filtering/sorting only as confirmed by product scope.
- Product detail includes image gallery, name, brand/SKU where relevant, description/specifications, selling unit, current price, bulk tiers, availability and quantity constraints.

### 8.4 Homepage CMS and banners
- App requests homepage configuration from the backend and renders supported sections in the returned order.
- Supported section types initially: `category_shortcuts`, `hero_carousel`, `trust_strip`, `category_grid`, `order_again_rail`, `product_rail`, `offer_tiles`, `informational_strip`.
- Unsupported optional section types must be skipped safely and logged; they must not crash the homepage.
- Banner targeting may use placement, publication status, date/time window and approved location/audience rules.
- Banner content includes image URL, title, subtitle, CTA label/type/target, alt text, offer terms, schedule and ordering.
- Banner changes must appear through refresh/cache invalidation policy without app release.
- App refreshes homepage content on cold start, user pull-to-refresh and configurable foreground/TTL policy.
- CMS content must use allowlisted CTA types and destinations. External links must be HTTPS and validated.
- Campaign terms must also be accessible as text, not only embedded in artwork.

### 8.5 Products and pricing
- Product response includes stable product ID, display name, SKU/brand if relevant, category, images, selling unit/pack size, current price, currency and availability.
- Prices and discount rules must never be hardcoded in the app.
- Use integer minor units for money (paise for INR) or one explicitly documented decimal-string convention. Do not use floating-point arithmetic for money.
- The backend validates active status, location eligibility, minimum order quantity, pack multiples, price rules, tax and discount eligibility.
- The UI clearly distinguishes regular unit price from a quantity-based price or discount.
- Price must be refreshed/revalidated when location or cart quantity changes.

### 8.6 Bulk discounts
- Bulk price tiers are configured in the backend/admin portal.
- A tier can define minimum/maximum quantity, price or discount type/value, effective dates, location/audience constraints and terms.
- Display the qualifying quantity and unit (e.g. “Buy 10+ bags to get this unit price”).
- Backend owns precedence when more than one discount applies. The rule must be documented and tested.
- Do not stack discounts unless an explicit rule allows stacking.
- Recalculate when quantity changes and explain when a tier is no longer applicable.

### 8.7 Cart
- Add products, change quantities and remove items.
- Show quantity controls, line totals, discounts and cart total from the API.
- Prevent accidental duplicate requests and show pending/error states.
- Server validates product status, serviceability, current price, inventory, pack multiples and bulk tiers.
- Before checkout/order placement (if in scope), revalidate all cart lines.
- If price or stock changes, return a structured conflict and show the user the revised value before proceeding.
- Cart persistence for guests vs signed-in users must be agreed before implementation.

### 8.8 Order Again and order history
- Signed-in users see eligible reorderable items from past orders.
- Show current price and current availability, never historical price as if it were current.
- Support quick-add and “View all”.
- Unavailable items are clearly labelled; never substitute silently.
- First-time users see a useful empty state with a route to browse categories.
- Eligibility rules and order-history retention must be defined by the business.

### 8.9 Account, help and navigation
- Header cart badge reflects the server/app cart count using the agreed cart model.
- Account routes to login/profile according to the authentication policy.
- Help opens a configured support destination (phone, chat, web page or other agreed channel).
- Bottom navigation destinations: Home, Order Again, Categories and Help.
- Session expiry must be handled safely; do not expose tokens or sensitive data in logs.

### 8.10 Admin/content portal
- Role-based access for content editors and administrators.
- Banner lifecycle: draft, scheduled, published, paused and archived.
- Create/edit/preview/reorder/schedule/publish/unpublish operations.
- Validate required fields, image type/size, CTA target and start/end dates.
- Show publish status, last editor, timestamps and audit history.
- Homepage section ordering and visibility are configurable within supported section types.
- Admin mutations must be authorized server-side, not merely hidden in the UI.

## 9. CMS data contract and banner lifecycle

Suggested banner fields:
- `id`, `title`, `subtitle`, `imageUrl`, optional `mobileImageUrl`, `altText`
- `ctaLabel`, `ctaType`, `ctaTarget`
- `status`, `startsAt`, `endsAt`, `position`
- optional `audienceRules`, `locationRules`, `termsText`, `termsUrl`, `analyticsKey`
- `createdAt`, `updatedAt`, `contentVersion`

Publishing requirements:
1. Draft changes are not visible to customers until published or scheduled.
2. A scheduled banner becomes eligible only during its active time window.
3. Pausing/unpublishing removes it from active responses after the cache invalidation/TTL window.
4. Every successful publish increments the content version or equivalent cache validator.
5. App must have a safe fallback if an image fails to load or CMS response is unavailable.
6. App may cache the last valid public homepage for a documented maximum stale period.
7. No remote executable code is permitted.

## 10. SQL database requirements

Use **MySQL 8.0 with InnoDB** unless the project owner approves a different SQL engine.

- Use relational tables, primary keys, foreign keys, unique constraints, `NOT NULL` constraints and check constraints where supported/appropriate.
- Use transactions for operations that must succeed or fail together, including order creation and inventory reservation/deduction.
- Use versioned schema migrations in source control.
- Use `DECIMAL` for stored monetary values if decimal columns are used; do not use `FLOAT`/`DOUBLE` for money. API responses should use integer minor units or a documented decimal string.
- Store timestamps consistently (UTC recommended) and convert for user display.
- Add indexes for frequent lookups: product/category, active banner placement/date, location/stock, customer/order history and cart ownership.
- Define deletion/archival policy for products and orders. Avoid deleting records that are needed for audit/history.
- Use parameterized queries or a vetted ORM/query builder. Never concatenate untrusted user input into SQL.
- Credentials and production connection strings must be environment-based and never committed.
- Backups, restoration testing, least-privilege DB accounts and migration rollback/forward strategy are required.

See `DATABASE_SCHEMA.md` for proposed entities and relationships.

## 11. API and error-handling requirements

- Base path: `/api/v1`; HTTPS in every non-local environment.
- JSON requests/responses, stable IDs, ISO-8601 timestamps and consistent pagination.
- Standard error shape includes machine-readable `code`, user-safe `message`, `requestId`, `retryable` and optional `fieldErrors`.
- Handle offline, timeout, unauthorized, forbidden, validation, not-found, conflict and server-error states.
- Do not expose SQL errors, stack traces, internal paths or secrets to the client.
- API contract is draft until the backend publishes final OpenAPI documentation.

## 12. Security, privacy and observability

- Validate and authorize every protected API operation on the server.
- Store passwords only using an established password-hashing algorithm if password auth is used; prefer established auth libraries.
- Use short-lived access tokens and secure refresh/session handling according to the selected auth design.
- Apply rate limiting to authentication and sensitive endpoints.
- Validate uploaded media, enforce size/type limits and use signed upload URLs or authenticated upload paths where appropriate.
- Admin roles must be enforced server-side.
- Log request IDs, errors and important state changes without logging passwords, tokens or payment secrets.
- Define consent, retention and deletion policies for personal data before production launch.

## 13. Performance and accessibility

- Homepage should render the shell promptly and use skeletons/placeholders while remote content loads.
- Use appropriately sized/compressed images, caching and pagination.
- Avoid blocking the full screen while an independent section loads.
- Define and measure API and app performance targets before release; recommended initial target is p95 under 500 ms for common read endpoints under expected load, excluding external dependencies.
- Support scalable text, screen-reader labels, sufficient contrast, visible focus/selection and accessible touch targets.
- Provide alt text for meaningful campaign and product imagery.

## 14. Analytics events

At minimum, define events for:
- `home_viewed`, `location_selected`, `search_submitted`
- `category_opened`, `banner_viewed`, `banner_clicked`
- `product_viewed`, `bulk_tier_viewed`, `add_to_cart`
- `cart_viewed`, `order_again_viewed`, `help_opened`

Events should not include sensitive personal data. Event naming and analytics provider are to be confirmed.

## 15. Acceptance criteria

The release is acceptable when the following are demonstrated in staging:

1. A user can select a delivery location before shopping and change it later.
2. Homepage sections appear in the configured API order and unsupported optional sections do not crash the app.
3. An admin can update a banner image, headline, CTA, order and schedule; the mobile app shows the published change without a new app build, within the agreed cache/refresh window.
4. Banner failure falls back gracefully and offer terms remain accessible as text.
5. Category, search, product detail and product listing handle loading, empty, error and retry states.
6. Product cards show the current server price, selling unit and availability.
7. Bulk price eligibility and totals match backend calculations for below-threshold, at-threshold and above-threshold quantities.
8. Cart updates revalidate price and stock; conflicts are presented clearly.
9. Order Again uses current prices and flags unavailable products.
10. UI remains usable on supported small and large iOS/Android screens, with no page-level horizontal overflow.
11. Protected portal functions reject unauthorized requests even if called outside the UI.
12. SQL migrations can create a clean environment and upgrade an existing environment; key relationships and constraints are tested.
13. No production credentials are committed to Git.
14. API errors are user-safe and include a request ID for debugging.
15. Automated tests cover pricing, bulk discount precedence, stock/cart conflicts, banner schedule eligibility and permissions.

## 16. Open decisions before implementation

The product owner/backend team must confirm:
- MySQL hosting/version and ORM/query approach.
- Authentication method and guest-cart policy.
- Exact checkout, payment, order placement, cancellation, returns and invoice scope.
- Tax/GST display and calculation rules.
- Delivery fee, minimum order and serviceability rules.
- Bulk pricing precedence, stacking rules and pack-size multiples.
- Inventory model: single stock pool vs multiple warehouses/locations; reserve vs deduct timing.
- Final brand hex values, approved logo assets and font.
- CMS image storage/provider, image upload limits and responsive sizes.
- Analytics provider and privacy/retention policy.
- Supported OS versions and release/performance targets.
