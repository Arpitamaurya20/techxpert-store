# Techxpert Store — Mobile Application Architecture & Codeflow

**Product:** Techxpert Store — Customer Mobile Application  
**Framework:** Expo SDK 57 (React Native 0.86.3, React 19.2.3, TypeScript 6.0)  
**Routing:** Expo Router 57 (File-based navigation)  
**Reference:** [`docs/SRS.md`](./SRS.md), [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md), [`docs/WEB_SPEC.md`](./WEB_SPEC.md)

---

## 1. Executive Summary & Purpose

The mobile application (`app/`) is the primary customer-facing commerce platform for Techxpert Store, tailored for Indian **homeowners, contractors, and building trades professionals** purchasing construction, electrical, plumbing, hardware, and decorative materials.

This document outlines the end-to-end architecture, screen hierarchy, state management, checkout pipelines, and API contracts of the mobile app to ensure seamless coordination with the **Web Merchandising & Admin Portal (`web/`)**.

---

## 2. Technology Stack & Key Dependencies

| Component | Library / Engine | Purpose |
|---|---|---|
| **Mobile Runtime** | Expo SDK 57 / React Native 0.86.3 | Core cross-platform mobile engine (iOS & Android) |
| **Navigation** | `expo-router` ~57.0.26 | File-based type-safe nested routing |
| **Design & Typography** | `@expo-google-fonts/poppins` | Brand fonts (Regular 400, Medium 500, SemiBold 600, Bold 700) |
| **Icons** | `@expo/vector-icons` (Ionicons, MaterialCommunityIcons) | Consistent UI iconography |
| **Visual Effects** | `expo-blur`, `expo-linear-gradient` | Translucent glassmorphism headers and gradient accents |
| **Image Loading** | `expo-image` ~57.0.5 | High-performance cached image rendering |
| **Local Persistence** | `@react-native-async-storage/async-storage` 2.2.0 | Device-level storage for addresses, wishlist, search history |
| **Build & Deploy** | EAS (Expo Application Services) | Cloud builds, OTA updates, and binary submissions |

---

## 3. Directory Layout (`app/src/`)

```
app/src/
├── app/                      # Expo Router screen tree
│   ├── _layout.tsx           # Root stack navigator & font/splash loader
│   ├── index.tsx             # Entry redirect & session bootstrap
│   ├── (tabs)/               # Bottom tab navigator
│   │   ├── _layout.tsx       # Tab bar configuration & theme styling
│   │   ├── home.tsx          # Home discovery & promotional feed
│   │   ├── categories.tsx    # Category tree with subcategory search
│   │   ├── orders.tsx        # Order history & "Order Again" rail
│   │   ├── help.tsx          # Customer support & WhatsApp assistance
│   │   └── cart.tsx          # Cart management (hidden from tab bar)
│   ├── products/
│   │   ├── index.tsx         # Search results & catalog browsing grid
│   │   └── [id].tsx          # Comprehensive product details page
│   ├── category/[id].tsx     # Category landing with subcategory chips
│   ├── project/[id].tsx      # "Shop by Project" curated category rail
│   ├── calculator.tsx        # Interactive material estimation tool
│   ├── delivery-location.tsx # Address selector & management modal
│   ├── address-form.tsx      # Add/edit shipping address form
│   ├── checkout.tsx          # Multi-step checkout & payment selection
│   ├── order-placed.tsx      # Animated post-checkout order confirmation
│   ├── wishlist.tsx          # Saved favorite items list
│   ├── profile.tsx           # Account settings & navigation drawer
│   ├── faq.tsx               # Accordion FAQ screen
│   ├── language.tsx          # Localization language selector
│   └── about/                # Corporate profile & legal compliance
├── components/
│   ├── auth/                 # Sign-in & OTP modal inputs
│   ├── brand/                # Techxpert logo & brandmarks
│   ├── home/                 # HeroCarousel, SearchSuggestions, Rails, QuickTools
│   ├── store/                # ProductCard, AddToCartBar, FilterSheet, StoreHeader
│   └── ui/                   # GlassBackground, GlassScreenHeader, Button, Toast
├── constants/                # Theme colors, brand tokens, typography
├── data/                     # Offline fallback catalogs & static legal documents
├── hooks/                    # useAddToCart, useAsyncData, useReorder, useStoreLayout
├── services/                 # apiClient, apiConfig, authService, productApi, orderApi
├── state/                    # Reactive stores: cartStore, locationStore, wishlistStore
├── types/                    # Catalog, Product, Order TypeScript definitions
└── utils/                    # Material calculations, pricing formatters, validations
```

---

## 4. Screen-by-Screen Codeflow & Workflows

### 4.1 Discovery Flow (`(tabs)/home.tsx`)
1. **Header (`StoreHeader.tsx`)**:
   - Pinned sticky header with `GlassBackground`.
   - Displays delivery city & pincode (links to `/delivery-location`).
   - Real-time search bar with autocomplete suggestions (`SearchSuggestions.tsx`) and historical tags (`searchHistoryStore.ts`).
   - Profile shortcut (`/profile`) and Cart button with live item counter badge (`useCartCount()`).
2. **Category Shortcuts (`CategoryShortcuts.tsx`)**:
   - Quick visual pills for popular construction materials (Cement, TMT Steel, Paint, Tiles, Sanitaryware).
3. **Hero Carousel (`HeroCarousel.tsx`)**:
   - Promotional slider synchronized directly with CMS campaigns created in the Web Portal.
4. **Trust Strip (`TrustStrip.tsx`)**:
   - Highlights brand authenticity, wholesale bulk pricing, and direct site delivery.
5. **Quick Tools (`QuickTools.tsx`)**:
   - 1-tap shortcuts to the **Material Calculator**, Saved Wishlist, and Contractor Assistance.
6. **Order Again Rail (`OrderAgainSection.tsx`)**:
   - Authenticated: Displays the customer's top 10 reorderable items.
   - Guest: Displays recommended essentials.
7. **Shop By Project (`ShopByProject.tsx` & `project/[id].tsx`)**:
   - Bundles materials by project phase: Painting, Flooring, Bath Renovation, Masonry.
8. **Featured Rails & Recently Viewed (`FeaturedProductsRail.tsx`)**:
   - Horizontal scrolling rails with `RailProductCard`, dynamic stock status, and 1-tap Add-to-Cart.

### 4.2 Category & Search Flow (`categories.tsx`, `products/index.tsx`, `category/[id].tsx`)
- Two-level hierarchy: Categories (e.g., Electricals) and Subcategories (e.g., Wires & Cables, Switches, LED Battens).
- Real-time subcategory filtering: typing in the search bar dynamically filters both categories and their child subcategories.
- Filter & Sort Sheets (`ProductFilterSheet.tsx`, `ProductSortSheet.tsx`):
  - Filters: Price range, Brand multi-select, In-stock only, Discounted items.
  - Sorting: Price low-to-high, Price high-to-low, Newest arrivals, Discount %.

### 4.3 Product Details Flow (`products/[id].tsx`)
- **Image Gallery (`ProductImageGallery.tsx`)**: Swipeable image gallery with thumbnails.
- **Pricing & Discounts**: Regular price, verified MRP, calculated discount percentage, and GST breakdown.
- **Bulk Pricing Table**: Highlights tiered volume discounts configured in the backend (e.g. 5% off for 10+ units, 10% off for 50+ units).
- **Stock & Quantity Stepper**:
  - Validates Minimum Order Quantity (`minOrderQuantity`), order increment (`quantityStep`), and stock availability (`maxOrderQuantity`).
- **Pincode Delivery Check**: Checks estimated delivery turnaround for the active location.
- **Specifications Table (`ProductSpecifications.tsx`)**: Structured key-value technical specs (Grade, Material, Dimensions, Pack Size).
- **Persistent Wishlist (`WishlistButton.tsx`)**: Instant toggle persisted in `AsyncStorage`.
- **Sticky Purchase Bar (`AddToCartBar.tsx`)**: Fixed at screen bottom for instant cart addition.

### 4.4 Material Estimation Calculator (`calculator.tsx`)
Engineered specifically for construction site planning:
- **Paint Calculator**: Calculates required liters based on wall length, width, height, coat count (1/2/3), and ceiling coverage.
- **Tile Calculator**: Calculates required tile count and box count based on room dimensions, standard tile sizes (12x12, 24x24, etc.), and wastage allowance (+10%).
- **Cement Calculator**: Calculates bags of cement and sand parts for wall plastering (12mm/15mm) or concrete slab casting (4"/6").
- Directly integrates "Shop Now" buttons routing directly to corresponding store categories.

### 4.5 Delivery Location & Address Management (`delivery-location.tsx`, `address-form.tsx`)
- Address store (`locationStore.ts`) persists delivery locations to `techxpert.addresses` in `AsyncStorage`.
- Supports categorized address labels (`Home`, `Office`, `Site`).
- Supports setting a primary default address and inline deletion with an **Undo** snackbar.
- Delivery pincode is passed to catalog queries for local regional warehouse availability.

### 4.6 Cart & Checkout Pipeline (`cart.tsx`, `checkout.tsx`, `order-placed.tsx`)
1. **Cart Review (`cart.tsx`)**:
   - Displays line items with quantity adjustments, unit prices, and bulk savings notices.
   - Calculates subtotal in paise and rupees using fixed-precision financial helpers (`src/utils/format.ts`).
2. **Checkout Review (`checkout.tsx`)**:
   - Autofills saved delivery addresses from `locationStore` or user profile.
   - Validates Indian 10-digit mobile numbers (`normalizeIndianMobile`) and 6-digit postal pincodes (`validatePincode`).
   - Payment method selection: Currently supports **Cash on Delivery (COD)**; UPI and Debit/Credit cards are staged for future gateway integration.
3. **Atomic Server Placement**:
   - Calls `POST /orders` (`orderApi.placeOrder`).
   - The backend validates stock with row-level locks, applies bulk discounts, updates inventory, and creates order records.
4. **Order Confirmation (`order-placed.tsx`)**:
   - Displays celebratory spring animations, confetti, order number, delivery address, and routing to track in `orders`.

---

## 5. Reactive State Management Architecture

The mobile app employs a modular reactive store pattern (`createStore.ts` and `createPersistentStore.ts`) without the boilerplate of Redux:

```
+--------------------------------------------------------------------------+
|                              Client State                                |
+------------------------+------------------------+------------------------+
| In-Memory UI Stores    | Persistent Stores      | Network Cache Stores   |
| (createStore)          | (AsyncStorage backed)  | (useAsyncData Hook)    |
|------------------------|------------------------|------------------------|
| • cartStore            | • locationStore        | • home-categories      |
|   (items, MOQ, steps)  |   (saved addresses)    | • home-featured        |
| • sessionStore         | • wishlistStore        | • home-order-again     |
|   (JWT token, profile) |   (saved product IDs)  | • product-{id}         |
|                        | • recentlyViewedStore  | • orders-{userId}      |
|                        | • searchHistoryStore   |                        |
+------------------------+------------------------+------------------------+
```

---

## 6. API Service Contracts & Backend Integration

The app connects to the Node.js/Express backend (`server/`) via `apiClient.ts`:

| Route | Method | Payload / Params | Mobile App Usage |
|---|---|---|---|
| `/auth/login` | `POST` | `{ phone, password }` | Standard password sign-in |
| `/auth/otp/send` | `POST` | `{ phone }` | Requests OTP via SMS |
| `/auth/otp/verify`| `POST` | `{ phone, otp }` | Validates OTP and returns JWT |
| `/catalog/categories` | `GET` | — | Populates category shortcut rail and tab |
| `/catalog/subcategories` | `GET` | — | Populates subcategory drilldowns |
| `/catalog/products` | `GET` | `?search=&categoryId=&featured=` | Product listing, search results, and rails |
| `/catalog/products/:id` | `GET` | — | Full product specification & stock |
| `/orders` | `GET` | `Bearer Token` | Populates order history and "Order Again" |
| `/orders` | `POST` | `PlaceOrderInput` | Atomic checkout with inventory decrement |
| `/cms/banners` | `GET` | `?active=true` | Ingests promotional hero banners |
| `/pricing/bulk-tiers` | `GET` | `?productId=` | Ingests volume discount thresholds |

---

## 7. How the Mobile App Connects to the Web Portal (`web/`)

The Web Application serves as the **Merchandising & Operations Control Center** that dictates what mobile users experience:

1. **Banner CMS (`BannerCMS.tsx`)**:
   - Changes made to banners, promotional dates, hero copy, and deep-link routes in the Web Portal appear immediately in the mobile app's `HeroCarousel`.
2. **Bulk Pricing & Discount Rules (`BulkPricingManager.tsx`)**:
   - Merchandisers configure minimum order tiers (e.g. 20+ bags of cement get ₹15 off/bag). The mobile app displays these tiers on product pages and the backend validates them during atomic checkout.
3. **Catalog & Inventory Management (`CatalogOverview.tsx`)**:
   - Adding products, adjusting variants, or marking items out-of-stock instantly affects mobile product cards and disables Add-to-Cart buttons.
4. **Order Fulfillment & Status Updates (`OrdersManager.tsx`)**:
   - When a contractor places an order in the mobile app, it appears in the Web Portal orders table. Updating status (`placed` -> `confirmed` -> `packed` -> `shipped` -> `delivered`) updates the customer's mobile order tracking screen.
5. **Customer Accounts & Addresses (`UserManager.tsx`)**:
   - Customer profiles and delivery addresses saved in `homecare.users` and `homecare.user_addresses` are audited and managed through the web portal.
