# Techxpert Store — Dual-Database Relational Schema Specification

**Database Engine:** MySQL 8.0, InnoDB  
**Architecture:** Dual-Database Architecture (`homecare` + `techxpertstore`)  
**Character Set:** `utf8mb4` with `utf8mb4_unicode_ci` collation  
**Last Updated:** October 2026  

---

## 1. Architectural Separation

The platform operates across two dedicated MySQL databases:

| Database | Responsibility | Core Entities |
| :--- | :--- | :--- |
| **`homecare`** | **Identity, Authentication & Users** | `users`, `user_addresses`, `otp_attempts`, `refresh_tokens`, `admin_users` |
| **`techxpertstore`** | **Store Catalog, Commerce & Operations** | `products`, `categories`, `sub_categories`, `product_pricing`, `product_variants`, `product_highlights`, `product_specifications`, `inventory_stock`, `orders`, `order_items`, `order_status_history`, `carts`, `cart_items`, `saved_items`, `help_contact`, `help_faqs`, `home_shortcuts`, `home_projects`, `home_project_categories`, `search_suggestions`, `trust_claims`, `about_page`, `about_facts`, `about_values`, `policy_pages`, `policy_intro`, `policy_sections`, `policy_blocks`, `policy_bullets`, `home_deals`, `cms_banners`, `cms_homepage_sections`, `bulk_price_tiers`, `portal_audit_logs`, `portal_roles`, `portal_role_permissions`, `portal_staff`, `portal_staff_roles`, `portal_staff_scope`, `store_groups`, `store_group_stores`, `store_pincodes` |

```
[ homecare ] (User Accounts & Addresses)
    │
    │  user_id (referenced as UserID in store tables)
    ▼
[ techxpertstore ] (Orders, Carts, Catalog, CMS, Bulk Tiers)
```

---

## 2. `homecare` Database Schema (Identity & Users)

### 2.1 `homecare.users`
The authoritative customer registry across all Techxpert applications.

```sql
CREATE TABLE homecare.users (
  user_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  phone VARCHAR(15) NOT NULL UNIQUE,
  email VARCHAR(200) NULL UNIQUE,
  full_name VARCHAR(200) NULL,
  profile_image MEDIUMTEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_verified TINYINT(1) NOT NULL DEFAULT 0,
  email_verified TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_phone (phone),
  INDEX idx_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 2.2 `homecare.user_addresses`
Customer saved delivery locations used for address auto-selection and zone dispatch.

```sql
CREATE TABLE homecare.user_addresses (
  address_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  label VARCHAR(50) NOT NULL DEFAULT 'Home',
  flat_no VARCHAR(100) NOT NULL,
  building VARCHAR(200) NULL,
  area VARCHAR(200) NOT NULL,
  city VARCHAR(100) NOT NULL,
  pincode VARCHAR(10) NOT NULL,
  lat DOUBLE NULL,
  lng DOUBLE NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_addresses_user (user_id),
  INDEX idx_addresses_pincode (pincode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 2.3 `homecare.otp_attempts`
Records OTP dispatch, expiration, and verification attempts for passwordless sign-in.

```sql
CREATE TABLE homecare.otp_attempts (
  otp_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  phone VARCHAR(15) NOT NULL,
  otp_hash VARCHAR(64) NOT NULL, -- SHA-256 hash of OTP code
  purpose ENUM('login', 'register') NOT NULL DEFAULT 'login',
  attempts INT NOT NULL DEFAULT 0,
  expires_at DATETIME NOT NULL,
  is_used TINYINT(1) NOT NULL DEFAULT 0,
  ip_address VARCHAR(45) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_otp_phone (phone),
  INDEX idx_otp_lookup (phone, is_used, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 2.4 `homecare.refresh_tokens`
Long-lived session storage for mobile app refresh token rotations.

```sql
CREATE TABLE homecare.refresh_tokens (
  token_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token_hash VARCHAR(64) NOT NULL,
  device_info VARCHAR(255) NULL,
  ip_address VARCHAR(45) NULL,
  expires_at DATETIME NOT NULL,
  is_revoked TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tokens_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 2.5 `homecare.admin_users`
Homecare's staff logins; the live enum has more roles than shown here. Since portal access A3 the store portal does not list or accept these logins. It reads one only for a person deliberately linked in `techxpertstore.portal_staff.HomecareAdminID`: their name, email, `password_hash` at sign-in, and `is_active` on every request. `role` is ignored. The store never writes here (see [PORTAL_ACCESS.md](./PORTAL_ACCESS.md) §A3).

```sql
CREATE TABLE homecare.admin_users (
  admin_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('super_admin', 'admin', 'state_manager', 'region_manager') NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## 3. `techxpertstore` Database Schema (Commerce, Catalog & Operations)

### 3.1 Catalog & Inventory Hierarchy

```sql
-- Categories
CREATE TABLE techxpertstore.categories (
  ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  CategoryCode VARCHAR(50) NOT NULL UNIQUE,
  CategoryName VARCHAR(255) NOT NULL,
  CategoryDescription TEXT NULL,
  CategoryImage VARCHAR(500) NULL,
  DisplayOrder INT NOT NULL DEFAULT 100,
  IsActive TINYINT(1) NOT NULL DEFAULT 1,
  CreatedDate DATE NOT NULL,              -- no default: inserts must set it
  CreatedTime TIME NOT NULL,
  CreatedBy INT NULL,
  UpdatedDate DATE NULL,
  UpdatedTime TIME NULL,
  UpdatedBy INT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Sub-Categories
-- ID has no AUTO_INCREMENT in the live DB: the API takes MAX(ID)+1 under GET_LOCK('tx_subcategory_id_gen').
CREATE TABLE techxpertstore.sub_categories (
  ID INT NOT NULL PRIMARY KEY,
  CategoryID INT NOT NULL,
  SubCategoryCode VARCHAR(50) NOT NULL,
  SubCategoryName VARCHAR(255) NOT NULL,
  SubCategoryDescription TEXT NULL,
  SubCategoryImage VARCHAR(500) NULL,
  DisplayOrder INT NOT NULL DEFAULT 100,
  IsActive TINYINT(1) NOT NULL DEFAULT 1,
  CreatedDate DATE NOT NULL,
  CreatedTime TIME NOT NULL,
  CreatedBy INT NULL,
  UpdatedDate DATE NULL,
  UpdatedTime TIME NULL,
  UpdatedBy INT NULL,
  UNIQUE KEY SubCategoryCode_CategoryID (SubCategoryCode, CategoryID),
  INDEX idx_subcat_category (CategoryID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Products (103k+ SKUs)
CREATE TABLE techxpertstore.products (
  ID INT NOT NULL PRIMARY KEY,
  ProductCode VARCHAR(100) NOT NULL UNIQUE,
  ProductName VARCHAR(500) NOT NULL,
  ProductDescription TEXT NULL,
  ShortDescription VARCHAR(500) NULL,
  CategoryID INT NOT NULL,
  SubCategoryID INT NULL,
  Brand VARCHAR(255) NULL,
  ProductImage VARCHAR(500) NULL,
  MeasurementUnitID INT NULL,
  IsActive TINYINT(1) NOT NULL DEFAULT 1,
  IsFeatured TINYINT(1) NOT NULL DEFAULT 0,
  StockStatus ENUM('in_stock', 'out_of_stock', 'pre_order') NOT NULL DEFAULT 'in_stock',
  MinOrderQuantity INT NOT NULL DEFAULT 1,
  MaxOrderQuantity INT NULL,
  INDEX idx_products_cat (CategoryID),
  INDEX idx_products_brand (Brand),
  INDEX idx_products_active (IsActive)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Product Pricing
CREATE TABLE techxpertstore.product_pricing (
  ID INT NOT NULL PRIMARY KEY,
  ProductID INT NULL,
  VariantID INT NULL,
  CurrencyID INT NOT NULL DEFAULT 1,
  CostPrice DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  SellingPrice DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  MRP DECIMAL(15,2) NULL,
  IsActive TINYINT(1) NOT NULL DEFAULT 1,
  INDEX idx_pricing_product (ProductID),
  INDEX idx_pricing_variant (VariantID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

### 3.2 Orders & Fulfillment

```sql
-- Orders
CREATE TABLE techxpertstore.orders (
  ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  OrderNumber VARCHAR(50) NOT NULL UNIQUE,
  UserID INT NULL, -- Logical foreign reference to homecare.users.user_id
  CartID INT NULL, -- Cart the order was placed from; unique, so one cart becomes at most one order (shop S3)
  StoreID INT NULL, -- FK stores.ID: the store serving the delivery pincode at checkout (portal_scope.sql); scoped staff see only their stores' orders
  GuestEmail VARCHAR(255) NULL,
  GuestPhone VARCHAR(50) NULL,
  GuestName VARCHAR(255) NULL,
  ShippingAddress TEXT NULL,
  BillingAddress TEXT NULL,
  SubTotal DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  TaxTotal DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  DiscountTotal DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  GrandTotal DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  CurrencyID INT NOT NULL DEFAULT 1,
  OrderStatus ENUM('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled') NOT NULL DEFAULT 'pending',
  PaymentStatus ENUM('pending', 'paid', 'failed', 'refunded') NOT NULL DEFAULT 'pending',
  PaymentMethod VARCHAR(50) NULL,
  CreatedDate DATE NOT NULL,
  CreatedTime TIME NOT NULL,
  UpdatedDate DATE NULL,
  UpdatedTime TIME NULL,
  CreatedBy INT NULL,
  INDEX idx_orders_user (UserID),
  INDEX idx_orders_store (StoreID),
  UNIQUE INDEX uq_orders_cart (CartID),
  INDEX idx_orders_status (OrderStatus),
  INDEX idx_orders_date (CreatedDate)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Order Items
CREATE TABLE techxpertstore.order_items (
  ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  OrderID INT NOT NULL,
  VariantID INT NOT NULL,
  ProductID INT NOT NULL,
  Quantity INT NOT NULL DEFAULT 1,
  UnitPrice DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  TaxRate DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  TaxAmount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  DiscountAmount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  LineTotal DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  CreatedDate DATE NOT NULL,
  CreatedTime TIME NOT NULL,
  INDEX idx_order_items_order (OrderID),
  INDEX idx_order_items_product (ProductID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Order Status History
CREATE TABLE techxpertstore.order_status_history (
  ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  OrderID INT NOT NULL,
  OrderStatus ENUM('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled') NOT NULL,
  PaymentStatus ENUM('pending', 'paid', 'failed', 'refunded') NULL,
  Notes TEXT NULL,
  ChangedBy INT NULL,
  CreatedDate DATE NOT NULL,
  CreatedTime TIME NOT NULL,
  INDEX idx_history_order (OrderID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

### 3.3 Shopping Carts

```sql
-- Carts
CREATE TABLE techxpertstore.carts (
  ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  UserID INT NULL, -- Logical foreign reference to homecare.users.user_id
  SessionID VARCHAR(255) NULL,
  CurrencyID INT NOT NULL DEFAULT 1,
  Status ENUM('active', 'merged', 'abandoned', 'ordered') NOT NULL DEFAULT 'active', -- 'ordered': became an order (server/sql/shop_s3_checkout.sql)
  CreatedDate DATE NOT NULL,
  CreatedTime TIME NOT NULL,
  INDEX idx_carts_user (UserID),
  INDEX idx_carts_session (SessionID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Cart Items
CREATE TABLE techxpertstore.cart_items (
  ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  CartID INT NOT NULL,
  VariantID INT NOT NULL,
  Quantity INT NOT NULL DEFAULT 1,
  CreatedDate DATE NOT NULL,
  CreatedTime TIME NOT NULL,
  INDEX idx_cart_items_cart (CartID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Saved items (wishlist). See server/sql/saved_items.sql.
CREATE TABLE techxpertstore.saved_items (
  ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  UserID INT NULL, -- Logical reference to homecare.users.user_id. Null for a guest list.
  SessionID VARCHAR(128) NULL, -- Guest list. Null for an account list.
  ProductID INT NOT NULL,
  CreatedDate DATE NOT NULL,
  CreatedTime TIME NOT NULL,
  OwnerKey VARCHAR(160) AS (
    CASE WHEN UserID IS NOT NULL THEN CONCAT('u:', UserID) ELSE CONCAT('s:', SessionID) END
  ) STORED,
  UNIQUE KEY uq_saved_owner_product (OwnerKey, ProductID),
  INDEX idx_saved_user (UserID),
  INDEX idx_saved_session (SessionID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Product page points and specification rows. See server/sql/product_page.sql. Starts empty.
CREATE TABLE techxpertstore.product_highlights (
  ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  ProductID INT NOT NULL,
  Text VARCHAR(160) NOT NULL,
  Position INT NOT NULL,
  INDEX idx_product_highlights (ProductID, Position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE techxpertstore.product_specifications (
  ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  ProductID INT NOT NULL,
  SpecLabel VARCHAR(80) NOT NULL,
  SpecValue VARCHAR(160) NOT NULL,
  Position INT NOT NULL,
  INDEX idx_product_specifications (ProductID, Position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Help page. One contact row, questions in order. See server/sql/help_content.sql. Starts empty.
CREATE TABLE techxpertstore.help_contact (
  ID TINYINT NOT NULL PRIMARY KEY,
  Phone VARCHAR(20) NOT NULL DEFAULT '',
  PhoneLabel VARCHAR(40) NOT NULL DEFAULT '',
  Whatsapp VARCHAR(20) NOT NULL DEFAULT '',
  Email VARCHAR(120) NOT NULL DEFAULT '',
  Hours VARCHAR(80) NOT NULL DEFAULT '',
  UpdatedDate DATE NULL,
  UpdatedTime TIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE techxpertstore.help_faqs (
  ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  Question VARCHAR(300) NOT NULL,
  Answer VARCHAR(2000) NOT NULL,
  Position INT NOT NULL,
  CreatedDate DATE NOT NULL,
  CreatedTime TIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Home category row and project tiles. See server/sql/home_merch.sql. Starts empty.
CREATE TABLE techxpertstore.home_shortcuts (
  ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  CategoryID INT NOT NULL,
  Label VARCHAR(24) NOT NULL DEFAULT '',
  Position INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE techxpertstore.home_projects (
  ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  Title VARCHAR(60) NOT NULL,
  Subtitle VARCHAR(80) NOT NULL DEFAULT '',
  ImageURL VARCHAR(1000) NOT NULL DEFAULT '',
  Calculator VARCHAR(16) NOT NULL DEFAULT '',
  Position INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE techxpertstore.home_project_categories (
  ProjectID INT NOT NULL,
  CategoryID INT NOT NULL,
  Position INT NOT NULL,
  PRIMARY KEY (ProjectID, CategoryID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Home search chips. See server/sql/search_suggestions.sql. Starts empty.
CREATE TABLE techxpertstore.search_suggestions (
  ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  Phrase VARCHAR(40) NOT NULL,
  Position INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Home trust-strip claims. See server/sql/trust_claims.sql. Starts empty.
CREATE TABLE techxpertstore.trust_claims (
  ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  Label VARCHAR(32) NOT NULL,
  Icon VARCHAR(40) NOT NULL,
  Action VARCHAR(16) NOT NULL,
  Position INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- About us: mission, facts and values. See server/sql/about_page.sql. Starts empty.
CREATE TABLE techxpertstore.about_page (
  ID TINYINT NOT NULL PRIMARY KEY,
  MissionTitle VARCHAR(80) NOT NULL DEFAULT '',
  MissionBody VARCHAR(600) NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE techxpertstore.about_facts (
  ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  FactValue VARCHAR(16) NOT NULL,
  FactLabel VARCHAR(32) NOT NULL,
  Position INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE techxpertstore.about_values (
  ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  Icon VARCHAR(40) NOT NULL,
  Title VARCHAR(40) NOT NULL,
  Body VARCHAR(240) NOT NULL,
  Position INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Privacy, terms, cancellation and shipping. See server/sql/policies.sql. Starts empty.
CREATE TABLE techxpertstore.policy_pages (
  PolicyID VARCHAR(16) NOT NULL PRIMARY KEY,
  LastUpdated VARCHAR(40) NOT NULL DEFAULT '',
  SourceUrl VARCHAR(300) NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE techxpertstore.policy_intro (
  ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  PolicyID VARCHAR(16) NOT NULL,
  Paragraph VARCHAR(800) NOT NULL,
  Position INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE techxpertstore.policy_sections (
  ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  PolicyID VARCHAR(16) NOT NULL,
  Heading VARCHAR(120) NOT NULL,
  Position INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE techxpertstore.policy_blocks (
  ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  SectionID INT NOT NULL,
  Kind ENUM('paragraph', 'list') NOT NULL,
  Paragraph VARCHAR(800) NULL,
  Position INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE techxpertstore.policy_bullets (
  ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  BlockID INT NOT NULL,
  Bullet VARCHAR(400) NOT NULL,
  Position INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Deals-for-you tiles. See server/sql/home_deals.sql. Starts empty. Two tiles fill the row.
CREATE TABLE techxpertstore.home_deals (
  ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  CategoryID INT NOT NULL,
  Title VARCHAR(32) NOT NULL,
  Highlight VARCHAR(24) NOT NULL DEFAULT '',
  Tagline VARCHAR(60) NOT NULL DEFAULT '',
  Tone VARCHAR(8) NOT NULL,
  ImageURL VARCHAR(1000) NOT NULL DEFAULT '',
  Position INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

### 3.4 Merchandising CMS & Bulk Pricing Tiers

```sql
-- CMS Campaign Banners
CREATE TABLE techxpertstore.cms_banners (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  subtitle VARCHAR(500) NULL,
  image_url VARCHAR(1000) NOT NULL,
  cta_label VARCHAR(100) NOT NULL DEFAULT 'Shop Now',
  cta_type ENUM('category', 'product', 'deals', 'external') NOT NULL DEFAULT 'category',
  cta_target VARCHAR(255) NOT NULL,
  status ENUM('draft', 'scheduled', 'published', 'paused', 'archived') NOT NULL DEFAULT 'published',
  starts_at DATETIME NULL,
  ends_at DATETIME NULL,
  display_order INT NOT NULL DEFAULT 1,
  terms_text TEXT NULL,
  location_scope VARCHAR(255) DEFAULT 'All serviceable zones',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_banners_status (status),
  INDEX idx_banners_order (display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- CMS Homepage Dynamic Sections
CREATE TABLE techxpertstore.cms_homepage_sections (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  section_code VARCHAR(100) NOT NULL UNIQUE,
  section_type VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  display_order INT NOT NULL,
  is_enabled TINYINT(1) NOT NULL DEFAULT 1,
  description TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Portal merchandising audit trail (admin change history)
CREATE TABLE techxpertstore.portal_audit_logs (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  action VARCHAR(255) NOT NULL,
  entity ENUM('banner', 'section', 'bulk_tier', 'product', 'publish', 'order', 'category', 'delivery', 'access', 'store', 'help', 'about', 'policy') NOT NULL,
  details TEXT NULL,
  actor VARCHAR(255) NOT NULL DEFAULT 'Store Admin',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_created (created_at),
  INDEX idx_audit_entity (entity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Portal roles: per-module View / Edit / Delete (server/sql/portal_access.sql)
CREATE TABLE techxpertstore.portal_roles (
  ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  Name VARCHAR(80) NOT NULL UNIQUE,
  Description VARCHAR(255) NULL,
  CreatedBy INT NULL, CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedBy INT NULL, UpdatedAt TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE techxpertstore.portal_role_permissions (
  RoleID INT NOT NULL,              -- FK portal_roles.ID, cascade delete
  Module VARCHAR(40) NOT NULL,      -- products, categories, orders, delivery, stores, customers, pricing, banners, sections, audit, access
  CanView TINYINT(1) NOT NULL DEFAULT 0,
  CanEdit TINYINT(1) NOT NULL DEFAULT 0,
  CanDelete TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (RoleID, Module)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- The store's staff list (server/sql/portal_staff.sql, A3). Each row is a store login OR a linked Homecare login.
CREATE TABLE techxpertstore.portal_staff (
  ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY, -- starts at 1001; id 1 is the in-memory local dev seed
  HomecareAdminID INT NULL UNIQUE,  -- linked: homecare.admin_users.admin_id (no cross-schema FK); name/email/password read from there
  Name VARCHAR(120) NULL,           -- store login only
  Email VARCHAR(190) NULL UNIQUE,   -- store login only, lower-case
  PasswordHash VARCHAR(100) NULL,   -- store login only, bcrypt
  IsSuperAdmin TINYINT(1) NOT NULL DEFAULT 0,
  IsActive TINYINT(1) NOT NULL DEFAULT 1,
  MustChangePassword TINYINT(1) NOT NULL DEFAULT 0, -- set by add / reset; every endpoint but /auth/admin/me and /auth/admin/password refuses until changed
  PasswordChangedAt TIMESTAMP NULL, -- written from the API clock; tokens with iat before this second are refused
  LastLoginAt TIMESTAMP NULL,
  CreatedBy INT NULL, CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedBy INT NULL, UpdatedAt TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_portal_staff_kind CHECK (
    (HomecareAdminID IS NULL AND Name IS NOT NULL AND Email IS NOT NULL AND PasswordHash IS NOT NULL)
    OR (HomecareAdminID IS NOT NULL AND Email IS NULL AND PasswordHash IS NULL))
) ENGINE=InnoDB AUTO_INCREMENT=1001 DEFAULT CHARSET=utf8mb4;

-- One store role per staff member (AdminID until A3)
CREATE TABLE techxpertstore.portal_staff_roles (
  StaffID INT NOT NULL PRIMARY KEY, -- FK portal_staff.ID, cascade delete
  RoleID INT NOT NULL,              -- FK portal_roles.ID; a held role cannot be deleted
  ScopeAll TINYINT(1) NOT NULL DEFAULT 0, -- whole company (portal_scope.sql); 0 with no portal_staff_scope rows = sees no orders, pincodes or customers
  AssignedBy INT NULL,
  AssignedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Places a staff member covers (server/sql/portal_scope.sql). A group covers every group and store under it.
CREATE TABLE techxpertstore.portal_staff_scope (
  ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  StaffID INT NOT NULL,             -- FK portal_staff_roles.StaffID, cascade delete
  NodeType ENUM('group','store') NOT NULL,
  NodeID INT NOT NULL,              -- store_groups.ID or stores.ID
  AssignedBy INT NULL,
  AssignedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_portal_staff_scope (StaffID, NodeType, NodeID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Free tree of groups above stores (Zone, Area, Cluster...); nesting capped at 8 by the server
CREATE TABLE techxpertstore.store_groups (
  ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  Name VARCHAR(80) NOT NULL,
  Kind VARCHAR(40) NULL,
  ParentID INT NULL,                -- FK store_groups.ID; NULL = top level
  ParentKey INT AS (COALESCE(ParentID, 0)) STORED,
  CreatedBy INT NULL, CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedBy INT NULL, UpdatedAt TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_store_groups_sibling_name (ParentKey, Name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Where a store sits in the tree; no row = top level
CREATE TABLE techxpertstore.store_group_stores (
  StoreID INT NOT NULL PRIMARY KEY, -- FK stores.ID
  GroupID INT NOT NULL,             -- FK store_groups.ID
  UpdatedBy INT NULL,
  UpdatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Which store serves a delivery pincode; old links kept with IsActive = 0. Checkout refuses a pincode with no active link.
CREATE TABLE techxpertstore.store_pincodes (
  ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  StoreID INT NOT NULL,             -- FK stores.ID
  PincodeID INT NOT NULL,           -- FK pincodes.ID
  IsActive TINYINT(1) NOT NULL DEFAULT 1,
  ActivePincodeID INT AS (IF(IsActive = 1, PincodeID, NULL)) STORED,
  CreatedBy INT NULL, CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedBy INT NULL, UpdatedAt TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_store_pincodes_active (ActivePincodeID) -- one active store per pincode
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Bulk Contractor Price Tiers
CREATE TABLE techxpertstore.bulk_price_tiers (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
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
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_bulk_product (product_id),
  INDEX idx_bulk_category (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## 4. Query Execution & Connection Pooling

In [`server/src/db/mysql.ts`](server/src/db/mysql.ts), two connection pools enforce the dual-DB contract:

| Pool / helper | Env | Default DB | Allowed tables |
|---|---|---|---|
| `userPool` / `queryUsers` | `DB_USERS` | `homecare` | `users`, `user_addresses`, `otp_attempts`, `refresh_tokens`; `admin_users` read-only, for linked portal staff |
| `storePool` / `queryStore` | `DB_STORE` | `techxpertstore` | catalog, carts, orders, CMS, pricing, audit, portal staff and access (`portal_staff`, roles, scope, stores and groups) |

Copy [`server/.env.example`](server/.env.example) → `.env`. Boot logs and `GET /health` report both pools.

**File-store (`database.json`):** disabled by default. Set `ALLOW_FILE_STORE=1` only for local demo without MySQL. Otherwise MySQL failures return HTTP 503 — the portal must not silently show seed catalog.

**Same-host cross-DB JOINs** (both schemas on one MySQL instance) enrich identity ↔ commerce:
```sql
SELECT 
  o.ID,
  o.OrderNumber,
  o.GrandTotal,
  o.OrderStatus,
  u.full_name AS customerName,
  u.phone AS customerMobile
FROM orders o
LEFT JOIN homecare.users u ON o.UserID = u.user_id;
```
If the JOIN fails (identity DB down), order list degrades to guest/shipping fields only; customer directory degrades to zero spend rather than serving `database.json`.
