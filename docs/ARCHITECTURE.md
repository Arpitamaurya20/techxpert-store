# Techxpert Store — System Architecture

**Product:** Techxpert Store — Construction & Home Materials Commerce Platform  
**Target Market:** India (Homeowners & Contractors)  
**Last Updated:** October 2026  

---

## 1. Monorepo Organization

```
techxpert-store/
├── app/                  # Customer Mobile Application (Expo / React Native)
│   ├── src/              # Screens, components, services, state, assets
│   ├── app.json          # Expo configuration
│   └── package.json      # Mobile dependencies
├── server/               # Node.js + Express Backend API Service (Port 5001)
│   ├── src/routes/       # /catalog, /auth, /orders, /cms, /pricing
│   ├── src/db/           # MySQL dual-pool manager (homecare & techxpertstore)
│   └── package.json      # Express, JWT, MySQL2, Bcrypt
├── web/                  # Web Application / Merchandising & Admin Portal (Port 5173)
│   ├── src/components/   # Orders, Catalog, Customers (homecare), Bulk Pricing, Banners, API Explorer
│   └── index.html        # Entry HTML
├── docs/                 # Central Documentation Hub
│   ├── SRS.md            # Software Requirements Specification
│   ├── DATABASE_SCHEMA.md# Relational dual-database topology (homecare + techxpertstore)
│   ├── ARCHITECTURE.md   # Overall system architecture (this document)
│   ├── BACKEND_IMPLEMENTATION_SPEC.md # Endpoints, schemas & integration specs
│   ├── APP_WORKFLOW.md   # Mobile application architecture, codeflows & state
│   └── WEB_SPEC.md       # Web frontend specifications & guidelines
├── README.md             # Repository entry point & developer setup
└── .gitignore            # Root-level ignore rules
```

---

## 2. Multi-Platform & Dual-Database Topology

```
+------------------------------------+    +------------------------------------+
|         Customer Mobile App        |    |      Web Merchandising Portal      |
|      (React Native / Expo SDK)     |    |         (Vite / React TS)          |
+-----------------+------------------+    +-----------------+------------------+
                  |                                         |
                  | REST / JSON                             | REST / JSON
                  v                                         v
+------------------------------------------------------------------------------+
|                        Techxpert Backend API Service                         |
|                          (Node.js + Express / REST)                          |
+-----------------------+------------------------------+-----------------------+
                        |                              |
      Identity & Auth   |                              | Store Commerce & Catalog
                        v                              v
+------------------------------------+    +------------------------------------+
|          homecare Database         |    |        techxpertstore Database     |
|      (Customer & Identity Core)    |    |      (Commerce & Catalog Core)     |
|------------------------------------|    |------------------------------------|
| • users (user_id, phone, email)    |    | • products (103k+ SKUs)            |
| • user_addresses (pincode, city)   |    | • categories & sub_categories      |
| • otp_attempts (SHA-256 OTP hashes)|    | • product_pricing & variants       |
| • refresh_tokens (session tokens)  |    | • inventory_stock                  |
| • admin_users (Homecare staff)     |    | • orders & order_items             |
|                                    |    | • carts & cart_items               |
|                                    |    | • bulk_price_tiers & discounts     |
|                                    |    | • cms_banners & homepage_sections  |
+------------------------------------+    +------------------------------------+
                  ^                                    |
                  +--- UserID Foreign Reference -------+
```

---

## 3. Database Separation of Concerns

### A. `homecare` Database — Identity & User Management
The `homecare` database is the single source of truth for all user entities across the Techxpert ecosystem:
1. **Customer Identities (`homecare.users`)**:
   - Primary key: `user_id`.
   - Contact fields: Unique `phone` (10-digit mobile), unique `email`.
   - Profile: `full_name`, `profile_image`, verification states (`is_active`, `is_verified`, `email_verified`).
2. **Saved Delivery Addresses (`homecare.user_addresses`)**:
   - Primary key: `address_id`, Foreign key: `user_id`.
   - Location payload: `label` ('Home' | 'Office' | 'Site'), `flat_no`, `building`, `area`, `city`, `pincode`, geo-coordinates (`lat`, `lng`).
   - Flags: `is_default` (used for app delivery zone resolution), `is_deleted` (soft-delete).
3. **Authentication & OTP (`homecare.otp_attempts`)**:
   - Primary key: `otp_id`.
   - Fields: `phone`, `otp_hash` (SHA-256), `purpose` ('login' | 'register'), `expires_at`, `is_used`, `attempts`, `ip_address`.
4. **Session Lifecycle (`homecare.refresh_tokens`)**:
   - Primary key: `token_id`, Foreign key: `user_id`.
   - Fields: `token_hash`, `device_info`, `expires_at`, `is_revoked`.
5. **Homecare staff logins (`homecare.admin_users`)**:
   - Homecare's own. The store portal reads a row only for someone linked in `techxpertstore.portal_staff` (A3), and never writes here.
   - Store portal staff, store logins and links alike, live in `techxpertstore.portal_staff`; see [PORTAL_ACCESS.md](./PORTAL_ACCESS.md) §A3.

---

### B. `techxpertstore` Database — Catalog, Merchandising & Store Commerce
All commerce, fulfillment, and catalog assets reside in `techxpertstore`:
1. **Catalog & Inventory Hierarchy**:
   - `products`: 103,824+ construction and trade SKUs with titles, codes, descriptions, brands, packaging.
   - `categories` & `sub_categories`: Trade categorizations (Electrical, Lighting, Plumbing, Hardware).
   - `product_pricing`: Selling prices, MRPs, and active price effective dates.
   - `product_variants`: Variant definitions linked to product masters.
   - `inventory_stock`: Warehouse stock balances and reserved inventory.
   - `measurement_units`: Standard trade packaging units (bags, pieces, coils, boxes).
2. **Order Lifecycle & Transactions**:
   - `orders`: Store orders with primary key `ID`, unique `OrderNumber`, and foreign reference `UserID` (pointing to `homecare.users.user_id`).
   - `order_items`: Line item snapshots with product IDs, quantities, unit prices, tax rates, line totals.
   - `order_status_history`: State transitions (`pending` → `confirmed` → `processing` → `shipped` → `delivered`) with timestamp and admin actor.
3. **Shopping Carts**:
   - `carts`: Active customer baskets referencing `UserID` (from `homecare.users`) or session tokens for guests.
   - `cart_items`: Variant IDs, quantities, and timestamps.
4. **Merchandising & CMS**:
   - `cms_banners`: Dynamic promotional banners for the mobile app home screen with image URLs, CTA targets, schedules, and display order.
   - `cms_homepage_sections`: Dynamic ordering and toggle controls for mobile screen sections.
   - `bulk_price_tiers`: Volume quantity pricing thresholds and percentage discount tiers for contractor procurement.
5. **Portal staff & access** ([PORTAL_ACCESS.md](./PORTAL_ACCESS.md)):
   - `portal_staff`: who may sign in to the portal. Each person is a store login (own email and bcrypt password) or a linked Homecare login (`HomecareAdminID`).
   - `portal_roles`, `portal_role_permissions`, `portal_staff_roles`: one store role per person, with View / Edit / Delete per module.
   - `portal_staff_scope`, `store_groups`, `store_group_stores`, `store_pincodes`: the places each person covers.
   - `portal_audit_logs`: who changed what in the portal.

---

## 4. Cross-Database Integration Architecture

1. **User Identity Linking**:
   - Orders placed by mobile users persist `UserID = homecare.users.user_id`.
   - If a customer places an order as a guest, `GuestName`, `GuestPhone`, and `GuestEmail` are stored on `techxpertstore.orders`.
2. **Cross-Database Queries**:
   - Because both databases reside on the same MySQL cluster, the backend performs joins (store pool default schema = `techxpertstore`):
     ```sql
     SELECT o.*, u.full_name as customerName, u.phone as customerMobile, u.email as customerEmail
     FROM orders o
     LEFT JOIN homecare.users u ON o.UserID = u.user_id;
     ```
   - Login/admin never read catalog tables; catalog mutations never write `homecare`. See `GET /health` → `db.users` / `db.store`.
3. **Admin Operations Portal**:
   - The web portal provides unified operations: staff can inspect customer accounts from `homecare`, review customer order history from `techxpertstore`, modify catalog prices, adjust bulk contractor tiers, and manage hero campaign banners.
   - Only people on `techxpertstore.portal_staff` can sign in. Someone who also works in Homecare is linked and signs in with their Homecare password; the store reads their `homecare.admin_users` row and never writes it.
