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
| **`techxpertstore`** | **Store Catalog, Commerce & Operations** | `products`, `categories`, `sub_categories`, `product_pricing`, `product_variants`, `inventory_stock`, `orders`, `order_items`, `order_status_history`, `carts`, `cart_items`, `cms_banners`, `cms_homepage_sections`, `bulk_price_tiers` |

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
Staff and internal administrator credentials for the Merchandising & Admin Portal.

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
  IsActive TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Sub-Categories
CREATE TABLE techxpertstore.sub_categories (
  ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  CategoryID INT NOT NULL,
  SubCategoryCode VARCHAR(50) NOT NULL UNIQUE,
  SubCategoryName VARCHAR(255) NOT NULL,
  SubCategoryImage VARCHAR(500) NULL,
  DisplayOrder INT NOT NULL DEFAULT 100,
  IsActive TINYINT(1) NOT NULL DEFAULT 1,
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
  Status ENUM('active', 'merged', 'abandoned') NOT NULL DEFAULT 'active',
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

In [`server/src/db/mysql.ts`](file:///Users/satwik/Desktop/techxpert-store/server/src/db/mysql.ts), two high-throughput connection pools are maintained:
1. `storePool`: Directed to `techxpertstore` (Catalog, Pricing, Orders, Carts, CMS).
2. `userPool`: Directed to `homecare` (Users, User Addresses, OTP attempts, Refresh Tokens).

Cross-database joins are executed efficiently on the same MySQL host:
```sql
SELECT 
  o.ID,
  o.OrderNumber,
  o.GrandTotal,
  o.OrderStatus,
  u.full_name AS customerName,
  u.phone AS customerMobile
FROM techxpertstore.orders o
LEFT JOIN homecare.users u ON o.UserID = u.user_id;
```
