# Techxpert Store — Backend Implementation Specification

**Document Version:** 2.0  
**Date:** October 2026  
**Status:** Approved for Implementation  
**Product:** Techxpert Store — Construction & Home Materials Platform  
**Architecture:** Node.js + Express REST API with Multi-Database MySQL Architecture  
**Clients:** React Native Customer Mobile App (`app/`) & React Store Management Portal (`web/`)  

---

## 1. Executive Summary & Architecture Strategy

This document provides the definitive technical specification for rebuilding the Techxpert Store backend service (`server/`). It bridges the product requirements in [`docs/SRS.md`](./SRS.md) and the operational workflows of the Expo mobile app and the store management portal.

### 1.1 Architectural Decisions

1. **Retain Existing Listings from `techxpertstore`**:
   The existing MySQL database `techxpertstore` contains over 110,000 curated products, categories, subcategories, pricing, and variants. The new backend **directly leverages these existing listing tables** rather than rebuilding catalog data from scratch.
2. **Dedicated User Management Database (`techxpert_users`)**:
   As required, all user identities, contractor credentials, profiles, saved addresses, and sessions are segregated into an isolated, secure database schema (`techxpert_users`).
3. **Dedicated Commerce & CMS Database (`techxpert_commerce`)**:
   Customer shopping carts, orders, status transition history, contractor bulk discount tiers, and CMS homepage merchandising banners are structured cleanly in `techxpert_commerce` with relational references to product IDs in the catalog.
4. **Single Source of Truth API**:
   Neither the React Native mobile app nor the React web portal connects directly to MySQL. All mutations, price calculations, and catalog queries flow through the unified Express REST API on `http://localhost:5001`.

---

## 2. Multi-Database System Topology

```
+------------------------------------+    +------------------------------------+
|       Customer Mobile App          |    |      Store Management Portal       |
|    (Expo / React Native / TS)      |    |         (React + Vite / TS)        |
+-----------------+------------------+    +-----------------+------------------+
                  |                                         |
                  | REST / JSON                             | REST / JSON
                  v                                         v
+------------------------------------------------------------------------------+
|                         Techxpert Backend API Service                        |
|                           (Node.js + Express 4.x)                            |
+-------------------+--------------------+--------------------+----------------+
                    |                    |                    |
        Pool 1: SQL |        Pool 2: SQL |        Pool 3: SQL |
                    v                    v                    v
+-----------------------+ +----------------------+ +-------------------------+
|     techxpertstore    | |   techxpert_users    | |   techxpert_commerce    |
| (Catalog & Listings)  | |  (Auth & Profiles)   | |  (Carts, Orders, CMS)   |
| • 110,108 Products    | | • users              | | • carts / cart_items    |
| • 19 Categories       | | • user_profiles      | | • orders / order_items  |
| • 98 Subcategories    | | • user_addresses     | | • order_status_history  |
| • product_pricing     | | • user_sessions      | | • bulk_price_tiers      |
| • inventory_stock     | | • auth_audit_logs    | | • cms_banners           |
| • measurement_units   | |                      | | • cms_homepage_sections |
+-----------------------+ +----------------------+ +-------------------------+
```

---

## 3. Database 1 Audit: Existing Listings (`techxpertstore`)

The existing database contains 81 tables. The following modules and tables have been audited and mapped for backend catalog operations:

### 3.1 Primary Retained Listings Tables

| Table Name | Row Count | Primary Columns Used | Role in Backend Service |
|---|---|---|---|
| `categories` | 19 | `ID`, `CategoryCode`, `CategoryName`, `CategoryImage`, `DisplayOrder`, `IsActive` | Root catalog taxonomy served via `GET /catalog/categories`. |
| `sub_categories` | 98 | `ID`, `CategoryID`, `SubCategoryCode`, `SubCategoryName`, `SubCategoryImage`, `DisplayOrder`, `IsActive` | Product types under categories served via `GET /catalog/subcategories`. |
| `products` | 103,824+ | `ID`, `ProductCode`, `ProductName`, `ProductDescription`, `CategoryID`, `SubCategoryID`, `Brand`, `ProductImage`, `ProductGallery`, `StockStatus`, `MinOrderQuantity`, `MaxOrderQuantity`, `IsActive`, `IsFeatured` | Master material listing table served via `GET /catalog/products` and `GET /catalog/products/:id`. |
| `product_variants` | 109,120 | `ID`, `ProductID`, `VariantSKU`, `VariantName`, `Weight`, `Dimensions` | SKU variations (sizes, packaging, pack multiples). |
| `product_pricing` | 109,641 | `ProductID`, `VariantID`, `CostPrice`, `SellingPrice`, `MRP`, `IsActive`, `EffectiveFrom`, `EffectiveTo` | Authoritative regular selling price and strike-through MRP. |
| `inventory_stock` | 109,868 | `VariantID`, `WarehouseID`, `StockQuantity`, `ReservedQuantity`, `AvailableQuantity` | Real-time stock availability and inventory validation. |
| `measurement_units`| 7 | `ID`, `UnitCode`, `UnitName` | Selling units (e.g., `50 kg bag`, `sq ft`, `litre`, `pack`). |
| `product_seo` | 108,256 | `ProductID`, `MetaTitle`, `MetaDescription`, `Keywords`, `Slug` | SEO and search indexing. |
| `product_discounts`| 3 | `ProductID`, `DiscountType`, `DiscountValue`, `StartDate`, `EndDate` | Direct product discount campaigns. |

### 3.2 Existing Supplementary Tables Available for Extension
- **Location & Logistics**: `pincodes`, `areas`, `districts`, `states`, `countries`, `landmarks`, `delivery_slots`, `couriers`.
- **Stores & Fulfillment**: `stores`, `warehouses`, `store_warehouse_mapping`.
- **Finance & Tax**: `currency_master` (INR), `tax_master` (GST rules), `tax_rates`.

### 3.3 Tables Bypassed in `techxpertstore`
Legacy user, cart, and order tables in `techxpertstore` (e.g. `users`, `user_details`, `carts`, `cart_items`) are bypassed in favor of clean, normalized schemas in `techxpert_users` and `techxpert_commerce`.

---

## 4. Database 2: User Management Architecture (`techxpert_users`)

Isolated database schema dedicated to identity, authentication, profile roles, and site delivery addresses.

### 4.1 Schema Definition

```sql
CREATE DATABASE IF NOT EXISTS techxpert_users 
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE techxpert_users;

-- Master authentication identities
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_uuid VARCHAR(64) UNIQUE NOT NULL,
  mobile VARCHAR(20) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('customer', 'contractor', 'admin', 'content_editor') NOT NULL DEFAULT 'customer',
  is_verified TINYINT(1) NOT NULL DEFAULT 1,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_mobile (mobile),
  INDEX idx_users_email (email),
  INDEX idx_users_role (role)
) ENGINE=InnoDB;

-- Contractor and customer profile metadata
CREATE TABLE user_profiles (
  user_id INT PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  company_name VARCHAR(255) NULL,
  gstin VARCHAR(50) NULL,
  trade_type VARCHAR(100) NULL,
  default_pincode VARCHAR(10) NULL,
  default_city VARCHAR(100) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_profile_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Delivery addresses (Job sites, residential, billing)
CREATE TABLE user_addresses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  recipient_name VARCHAR(255) NOT NULL,
  recipient_mobile VARCHAR(20) NOT NULL,
  address_line1 VARCHAR(500) NOT NULL,
  address_line2 VARCHAR(500) NULL,
  landmark VARCHAR(255) NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100) NOT NULL,
  pincode VARCHAR(10) NOT NULL,
  address_type ENUM('site', 'billing', 'home', 'warehouse') NOT NULL DEFAULT 'site',
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_address_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  INDEX idx_addr_pincode (pincode)
) ENGINE=InnoDB;

-- Active sessions and tokens
CREATE TABLE user_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  device_info VARCHAR(255) NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;
```

---

## 5. Database 3: Commerce & CMS Architecture (`techxpert_commerce`)

Handles shopping carts, order execution, wholesale pricing rules, and dynamic homepage banners.

### 5.1 Schema Definition

```sql
CREATE DATABASE IF NOT EXISTS techxpert_commerce 
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE techxpert_commerce;

-- Transient customer carts (Guest and Authenticated)
CREATE TABLE carts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cart_uuid VARCHAR(64) UNIQUE NOT NULL,
  user_id INT NULL,
  session_token VARCHAR(128) NULL,
  status ENUM('active', 'converted', 'abandoned') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_cart_user (user_id),
  INDEX idx_cart_session (session_token)
) ENGINE=InnoDB;

-- Individual items in carts
CREATE TABLE cart_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cart_id INT NOT NULL,
  product_id INT NOT NULL,
  variant_id INT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(15,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_cart_item FOREIGN KEY (cart_id) REFERENCES carts (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Orders Master
CREATE TABLE orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_number VARCHAR(64) UNIQUE NOT NULL,
  user_id INT NULL,
  order_status ENUM('placed', 'confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned') NOT NULL DEFAULT 'placed',
  total_amount DECIMAL(15,2) NOT NULL,
  subtotal DECIMAL(15,2) NOT NULL,
  discount_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  delivery_fee DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  delivery_address TEXT NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_mobile VARCHAR(20) NOT NULL,
  payment_method VARCHAR(50) NOT NULL DEFAULT 'cod',
  payment_status ENUM('pending', 'paid', 'failed', 'refunded') NOT NULL DEFAULT 'pending',
  placed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_order_user (user_id),
  INDEX idx_order_status (order_status),
  INDEX idx_order_num (order_number)
) ENGINE=InnoDB;

-- Immutable line item snapshot at time of checkout
CREATE TABLE order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  variant_id INT NULL,
  product_name VARCHAR(500) NOT NULL,
  sku VARCHAR(100) NULL,
  unit VARCHAR(50) NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(15,2) NOT NULL,
  mrp DECIMAL(15,2) NULL,
  line_total DECIMAL(15,2) NOT NULL,
  CONSTRAINT fk_order_items FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Audit trail for state transitions
CREATE TABLE order_status_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  from_status VARCHAR(50) NULL,
  to_status VARCHAR(50) NOT NULL,
  note TEXT NULL,
  changed_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_order_history FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Wholesale Volume Discount Rules
CREATE TABLE bulk_price_tiers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NULL,
  category_id INT NULL,
  product_name VARCHAR(255) NOT NULL,
  min_quantity INT NOT NULL,
  max_quantity INT NULL,
  discount_type ENUM('percentage', 'fixed_price') NOT NULL DEFAULT 'percentage',
  discount_value DECIMAL(10,2) NOT NULL,
  terms_condition TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- CMS Banners for Hero Carousel
CREATE TABLE cms_banners (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  subtitle VARCHAR(500) NULL,
  image_url VARCHAR(1000) NOT NULL,
  cta_label VARCHAR(100) NOT NULL,
  cta_type ENUM('category', 'product', 'deals', 'external') NOT NULL DEFAULT 'category',
  cta_target VARCHAR(255) NOT NULL,
  status ENUM('draft', 'scheduled', 'published', 'paused', 'archived') NOT NULL DEFAULT 'published',
  starts_at DATETIME NULL,
  ends_at DATETIME NULL,
  display_order INT NOT NULL DEFAULT 1,
  terms_text TEXT NULL,
  location_scope VARCHAR(255) NULL DEFAULT 'All serviceable zones',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Homepage Section Arrangements
CREATE TABLE cms_homepage_sections (
  id INT AUTO_INCREMENT PRIMARY KEY,
  section_code VARCHAR(100) UNIQUE NOT NULL,
  section_type VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  display_order INT NOT NULL,
  is_enabled TINYINT(1) NOT NULL DEFAULT 1,
  description TEXT NULL
) ENGINE=InnoDB;
```

---

## 6. Detailed Backend Workflows & Query Mappings

### 6.1 Catalog Browsing (`GET /catalog/products`)
```sql
SELECT 
  p.ID AS id,
  p.ProductCode AS sku,
  p.ProductName AS name,
  p.ProductDescription AS description,
  p.CategoryID AS categoryId,
  c.CategoryName AS categoryName,
  p.SubCategoryID AS subcategoryId,
  p.Brand AS brandName,
  p.ProductImage AS imageUrl,
  p.StockStatus AS stockStatus,
  p.MinOrderQuantity AS minOrderQuantity,
  p.MaxOrderQuantity AS maxOrderQuantity,
  p.IsFeatured AS featured,
  pr.SellingPrice AS price,
  pr.MRP AS originalPrice,
  mu.UnitName AS unit,
  COALESCE(inv.StockQuantity, 100) AS stockQuantity
FROM techxpertstore.products p
JOIN techxpertstore.categories c ON c.ID = p.CategoryID
LEFT JOIN techxpertstore.sub_categories sc ON sc.ID = p.SubCategoryID
LEFT JOIN techxpertstore.measurement_units mu ON mu.ID = p.MeasurementUnitID
LEFT JOIN techxpertstore.product_pricing pr ON pr.ProductID = p.ID AND pr.IsActive = 1
LEFT JOIN techxpertstore.product_variants pv ON pv.ProductID = p.ID
LEFT JOIN techxpertstore.inventory_stock inv ON inv.VariantID = pv.ID
WHERE p.IsActive = 1
  AND (? IS NULL OR p.CategoryID = ?)
  AND (? IS NULL OR p.ProductName LIKE CONCAT('%', ?, '%'))
LIMIT ? OFFSET ?;
```

### 6.2 Authentication Workflow (`POST /auth/login`)
1. **Precondition**: Request contains `identifier` (mobile or email) and `password`.
2. **Validation**: Check regex for 10-digit Indian mobile number (`^[6-9]\d{9}$`) or valid email.
3. **Query**:
   ```sql
   SELECT u.id, u.user_uuid, u.mobile, u.email, u.password_hash, u.role,
          p.full_name, p.company_name, p.default_pincode, p.default_city
   FROM techxpert_users.users u
   LEFT JOIN techxpert_users.user_profiles p ON p.user_id = u.id
   WHERE u.mobile = ? OR u.email = ?;
   ```
4. **Verification**: Compare password hash. Return 401 if invalid.
5. **Token Generation**: Sign JWT containing `{ userId, role, mobile }` with 30-day validity.
6. **Response**: Return `{ token, user: { id, name, email, mobile, deliveryLocation: { pincode, city } } }`.

### 6.3 Order Placement & State Machine (`POST /orders` & `PUT /orders/:id/status`)
1. **Validation**:
   - Revalidate real-time selling price against `techxpertstore.product_pricing`.
   - Verify stock sufficiency against `techxpertstore.inventory_stock`.
   - Calculate bulk discount tiers from `techxpert_commerce.bulk_price_tiers`.
2. **Atomic Transaction**:
   - Generate unique order code: `TX-YYYY-XXXX`.
   - Insert into `techxpert_commerce.orders`.
   - Insert line snapshots into `techxpert_commerce.order_items`.
   - Record initial state in `techxpert_commerce.order_status_history`.
3. **State Transitions Allowed**:
   - `placed` → `confirmed`
   - `confirmed` → `packed`
   - `packed` → `shipped`
   - `shipped` → `out_for_delivery`
   - `out_for_delivery` → `delivered`
   - Any pre-shipped state → `cancelled`

---

## 7. Configuration & Environment Reference

The backend uses a multi-pool configuration in `server/src/db/mysql.ts`:

```env
# Server Port
PORT=5001

# MySQL Connection Details
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=root123

# Database Schemas
DB_CATALOG=techxpertstore
DB_USERS=techxpert_users
DB_COMMERCE=techxpert_commerce

# Authentication Secret
JWT_SECRET=techxpert-store-secret-key-2026
```

---

## 8. Implementation Milestones

1. **Phase 1: Multi-Pool MySQL Connector** — Implement connection pools in `server/` connecting to `techxpertstore`, `techxpert_users`, and `techxpert_commerce`.
2. **Phase 2: Real Listings Endpoint** — Wire `GET /catalog/products`, `GET /catalog/categories`, and `GET /catalog/subcategories` directly to MySQL queries over the 110,000+ items.
3. **Phase 3: User Auth & Saved Addresses** — Complete mobile authentication and profile management via `techxpert_users`.
4. **Phase 4: Commerce & Order Management** — Implement atomic order placement and status transitions via `techxpert_commerce`.
5. **Phase 5: Operations Portal Sync** — Connect portal tables to real database records with live search, status updates, and bulk tier rules.
