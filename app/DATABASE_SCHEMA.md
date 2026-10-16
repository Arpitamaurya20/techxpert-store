# Techxpert Store — SQL Data Model (Proposal)

**Database engine:** MySQL 8.0, InnoDB  
**Purpose:** Initial relational model for the customer app, backend and admin/content portal.

> This is a logical schema proposal, not a complete production migration. Confirm checkout, tax, inventory, warehouse, authentication and business rules before writing final migrations. Use version-controlled migration files.

## 1. Design principles

- Use primary keys and foreign keys for relationships.
- Use InnoDB transactions for inventory and order/cart operations.
- Use `DECIMAL` for monetary values in database columns; never use `FLOAT` or `DOUBLE` for money. The API may expose integer paise.
- Store timestamps in UTC where possible.
- Use `utf8mb4`.
- Add indexes based on actual query patterns and verify with query plans.
- Prefer `is_active`/status and archival over deleting records referenced by orders.
- Never allow the mobile app to connect directly to MySQL.
- Use parameterized queries or a vetted ORM.

## 2. Core entities

### Catalogue
- `categories`: category name, slug, image/icon URL, display order, active state.
- `brands`: brand name and active state.
- `products`: stable product ID, category, brand, SKU, name, description, selling unit, pack size, image references and active state.
- `product_images`: product, image URL, alt text, display order.
- `product_location_availability`: product/location availability and optional stock reference.

### Pricing and offers
- `product_prices`: product, location/price-list scope, currency, regular price, validity window and active state.
- `bulk_price_tiers`: product/price list, minimum/maximum quantity, price or discount, validity and terms.
- `offers`: offer metadata, validity, status and terms.
- `offer_products` (optional): mapping between offers and eligible products.

### Locations and inventory
- `delivery_locations`: location/address/service area reference and serviceability state.
- `inventory_locations`: warehouse/store/stock location.
- `inventory_balances`: product/location on-hand and reserved quantity.
- `inventory_movements`: auditable stock changes with reason, reference, actor and timestamp.

### Customers and commerce
- `customers`: customer identity/profile fields appropriate to the chosen auth design.
- `customer_addresses`: saved delivery addresses and location reference.
- `carts`: cart owner/session, status and timestamps.
- `cart_items`: cart, product, quantity and timestamps. Price should be revalidated; do not treat a client-supplied price as authoritative.
- `orders`: customer, address snapshot, status, totals and timestamps, only if order placement is in scope.
- `order_items`: product/name/unit/price/discount snapshots, quantity and line totals.
- `order_status_history`: state transitions and actor/time.

### CMS and administration
- `banners`: title, subtitle, desktop/mobile image URLs, alt text, CTA type/target, terms, placement, status, schedule and sort position.
- `homepage_sections`: section type, display order, visibility and JSON configuration restricted to supported schemas.
- `admin_users`: admin identity and status.
- `roles` and `admin_user_roles` (or equivalent): authorization model.
- `content_audit_logs`: editor, action, entity, timestamp and relevant before/after metadata.

## 3. Relationship overview

- One category has many products.
- One brand has many products; a product may have zero/one brand depending on catalogue policy.
- One product has many images, price records and bulk tiers.
- One inventory location has many product inventory balances.
- One product can have balances across multiple inventory locations.
- One customer has many addresses, carts and orders.
- One cart has many cart items; each cart item references a product.
- One order has many order items and status-history records.
- Homepage configuration has ordered sections; hero sections reference active banners.
- Admin users create/update CMS records; audit logs retain important changes.

## 4. Suggested MySQL conventions

- IDs: choose either `BIGINT UNSIGNED` auto-increment IDs or UUID/ULID identifiers consistently. Public APIs should not expose sequential identifiers if that creates a security/business concern.
- Text: use `VARCHAR` for bounded fields and `TEXT` for longer descriptions/terms.
- Money: `DECIMAL(12,2)` is acceptable for INR if the API conversion to paise is exact and consistent. Alternatively store integer paise in `BIGINT`; choose one policy and use it everywhere.
- Quantity: use `DECIMAL` if fractional units are allowed; use integer quantities if all products are sold in whole packs. Confirm per category/product.
- Status: use documented `VARCHAR` values or lookup tables; validate transitions in backend code.
- Time: use `DATETIME` consistently with UTC policy, or a documented timestamp convention.
- Indexes: examples include `products(category_id, is_active)`, `products(sku)`, `banners(placement, status, starts_at, ends_at, position)`, `inventory_balances(product_id, inventory_location_id)`, `orders(customer_id, created_at)`, `cart_items(cart_id, product_id)`.
- Constraints: unique SKU where appropriate, unique cart/product pair if the model allows only one line per product, non-negative quantity and valid date windows.
- Use foreign keys with intentional `ON DELETE` rules. Avoid cascade-deleting order history or audit records.

## 5. Transaction-critical workflows

### Add/update cart
1. Authenticate/resolve cart owner.
2. Validate product is active and allowed for the selected location.
3. Read current stock and price rules.
4. Validate quantity and pack multiples.
5. Apply the server-side bulk-price precedence rule.
6. Persist cart change in a transaction where consistency requires it.
7. Return authoritative line pricing, discount and cart summary.

### Reserve stock/order placement (only if included)
1. Begin transaction.
2. Lock or safely conditionally update relevant inventory balance rows.
3. Verify available stock and current price/discount rules.
4. Create order and immutable order-item snapshots.
5. Create inventory movement/reservation records.
6. Commit; on any failure, roll back and return a clear conflict/error.
7. Define reservation expiry and release logic if payment is introduced.

## 6. Banner publishing workflow

- Store banner metadata and publication schedule in MySQL.
- Store image files in object/file storage or a CDN; save only URLs/keys and metadata in MySQL.
- Validate status, dates, CTA type and target before publication.
- The public homepage API returns only eligible published banners/sections.
- Increment a content version or invalidate cache after publish/pause/reorder.
- App uses TTL/ETag/content version and fallback behaviour.
- Do not store executable JavaScript or arbitrary remote UI code in the CMS.

## 7. Items to finalize before schema migrations

1. Authentication provider and guest vs registered-user model.
2. Whether orders/payments/returns are included in the first release.
3. One or multiple warehouses and how delivery locations map to inventory.
4. Whether stock is reserved in cart or only at order placement.
5. GST/tax and invoice requirements.
6. Bulk discount priority, stacking and price-list rules.
7. Product quantity precision and pack multiples.
8. Media storage and upload flow.
9. Retention, audit and privacy requirements.
10. ORM/query layer and migration tool (e.g. Prisma, Sequelize, Knex, TypeORM, or SQL migrations).
