# App developer guide: local API and use cases

For whoever builds the customer app (`app/`). It covers getting the API running on your own machine, pointing the app at it, and every app flow with the exact calls, real request and response examples, and the refusals each one can give.

Everything below was checked against a local API on 23 Oct 2026. Example values come from the shared local database; the personal details in the signed-in examples are placeholders.

---

## 1. What you need

- **Node.js 20 or newer** and npm.
- **MySQL 8** running locally.
- **Both databases on that one MySQL**, because the API joins across them:
  - `techxpertstore`: the catalogue, prices, stock, carts, orders, home screen and delivery areas.
  - `homecare`: customer logins, OTP codes and saved addresses. The store API uses four of its tables: `users`, `user_addresses`, `otp_attempts` and `admin_users`.
- This repository.

## 2. Get the databases

There is no script that builds `techxpertstore` or `homecare` from nothing, so start from a copy of the team's local databases. Ask the backend owner to run this on their machine and send you the two files. **Never use a copy of production customer data.**

```bash
mysqldump -u root -p --single-transaction --routines techxpertstore > techxpertstore.sql
mysqldump -u root -p --single-transaction homecare users user_addresses otp_attempts admin_users > homecare_store_tables.sql
```

Load them on your machine:

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS techxpertstore; CREATE DATABASE IF NOT EXISTS homecare;"
mysql -u root -p techxpertstore < techxpertstore.sql
mysql -u root -p homecare < homecare_store_tables.sql
```

A copy from the team already has every script in `server/sql/` applied. If yours is older, run them in the order in [`server/sql/README.md`](../server/sql/README.md).

## 3. Start the API

```bash
cd server
cp .env.example .env      # then set MYSQL_PASSWORD to your local MySQL password
npm install
npm run dev               # restarts on code changes; API on http://localhost:5001
```

Keep `.env` close to the example:

- `ALLOW_DEV_ADMIN=1` turns on the local portal login (section 6).
- Don't set `NODE_ENV=production` locally, because that turns off the local sign-in shortcuts.

**Check it:** open `http://localhost:5001/health`. You want `"status":"ok"` with both `db.users.ok` and `db.store.ok` true. A 503 with `"degraded"` means MySQL isn't reachable or a database is missing.

`ALLOW_FILE_STORE=1` serves a small demo file when MySQL is down. It doesn't cover carts, checkout or sign-in, so don't build against it.

## 4. Point the app at it

In `app/.env.local` (git ignores it; copy `app/.env.example`):

```bash
EXPO_PUBLIC_API_BASE_URL=http://localhost:5001/api
```

The address depends on where the app runs:

| App runs on | Use |
|---|---|
| iOS simulator | `http://localhost:5001/api` |
| Android emulator | `http://10.0.2.2:5001/api` |
| A real phone (Expo Go or a dev build) on the same Wi-Fi | `http://<your computer's LAN IP>:5001/api`. On a Mac, `ipconfig getifaddr en0` prints it |

After changing `.env.local`, restart Expo with the cache cleared: `npx expo start -c`.

The API answers on both `/api/...` and `/...`. This guide writes paths without the `/api`, because it's already in the base URL above.

## 5. How the API talks

**Successful answers** come wrapped:

```json
{ "success": true, "data": { }, "message": "optional", "meta": { "page": 1, "limit": 50, "total": 2720, "totalPages": 55 } }
```

`meta` only appears on paged lists.

**Exception:** `POST /auth/login` and `POST /auth/verify-otp` return `{ "token", "user" }` with no wrapper.

**Refusals:**

```json
{ "success": false, "error": "We don't deliver to 110001 yet." }
```

- `error` is written for customers, so the app can show it as it is.
- Locally there is also a `details` field with the server stack trace. Never show it.

| Status | Meaning |
|---|---|
| 400 | The request is wrong, for example a missing field or a 5-digit pincode |
| 401 | Not signed in, or a wrong or expired OTP |
| 403 | Signed in, but this isn't yours |
| 404 | Not found |
| 409 | The request is fine, but the shop refuses it right now: over a limit, out of stock, changed prices, an area not served |
| 503 | The database is down |

**Signed-in calls** send `Authorization: Bearer <token>`. The customer token lasts 30 days.

**Guests** have no token. They send `x-session-id: <sessionId>`, which the server hands out on the first `GET /cart` (use case 6).

**Money:**
- Cart, checkout and order amounts are numbers in rupees.
- In catalogue answers, `price` and `originalPrice` are strings such as `"149.00"`, so convert them before doing maths.
- Never work out totals in the app. Show the server's numbers.

**Images:** `imageUrl` on products and categories is a path such as `store/assets/catalog/...` that no server hosts yet, so it won't load. Banner `imageUrl` values are full addresses.

## 6. Local shortcuts (never in production)

| Shortcut | What it does |
|---|---|
| OTP `123456` | Every phone's code locally. `POST /auth/send-otp` also returns it as `devOtp` |
| `POST /auth/login` with `{ "identifier": "<phone or email>" }` | Signs in an existing customer with no code. It's handy for testing screens, but production refuses it with a 403, so the real sign-in must use OTP (use case 7) |
| Portal login `admin@techxpert.in` / `admin123` | Needs `ALLOW_DEV_ADMIN=1`. See below |

**Making test data** (prices, stock, delivery pincodes, banners, home sections, bulk prices, order statuses) is done in the staff portal:

```bash
cd web
npm install
VITE_API_BASE_URL=http://localhost:5001 npm run dev    # http://localhost:5173
```

## 7. Test data you can count on locally

| What | Value |
|---|---|
| Priced, in-stock products | **5** "9W LED Bulb": ₹149, MRP ₹199, maximum 50 per order. **3** 48" Ceiling Fan: ₹1,999, maximum 10 per order |
| Bulk prices on product 5 | 10% off for 25–99 units; 18% off for 100 or more (but the order maximum is 50) |
| Most other products | No price, so they show as unavailable and can't be added to the cart. Only a handful of the 110,106 active products have a price; give more of them prices in the portal |
| A served pincode | `201301` (Sector-62) |
| An unserved pincode | `110001` |
| Free delivery | From ₹2,000 subtotal. Below that delivery is ₹99. GST is 18% of the subtotal |

---

## 8. Use cases

### UC-1 Home screen

**Screen:** Home. The first four calls are public. Order Again needs a sign-in.

| Call | Gives |
|---|---|
| `GET /cms/sections` | The home blocks the app should draw, in order, each with `enabled` |
| `GET /cms/home` | The category shortcut row and the project tiles (use case 14). Empty until staff fill them |
| `GET /cms/search-suggestions` | The "Try searching" chips (use case 15). Empty until staff fill them |
| `GET /cms/trust` | The trust-strip claims (use case 16). Empty until staff fill them |
| `GET /cms/banners` | Only the banners live right now, in order |
| `GET /catalog/products?featured=true&limit=10` | A rail of featured products |
| `GET /catalog/categories` | Category tiles |
| `GET /orders/again` | Signed in. Products this customer bought, at today's price and stock |

```json
GET /cms/sections → 200
{ "success": true, "data": [
  { "id": "1", "type": "hero_carousel", "sectionCode": "hero_carousel", "title": "Featured Promotions",
    "description": "Main hero carousel with high-impact offers", "enabled": true, "position": 1 } ] }
```

```json
GET /cms/banners → 200
{ "success": true, "data": [
  { "id": 1, "title": "Festive Mega Wiring Sale", "subtitle": "Up to 30% off on premium copper cables and switchgears",
    "imageUrl": "https://images.unsplash.com/photo-1558494949-…", "ctaLabel": "Shop Wiring",
    "ctaType": "category", "ctaTarget": "5", "status": "published", "startsAt": null, "endsAt": null,
    "position": 1, "termsText": null, "locationScope": "All serviceable zones", "updatedAt": "2026-10-16" } ] }
```

**Order Again** without a sign-in is `401` "Sign in to see your orders." It returns one row per product from this customer's orders, newest first. Cancelled orders are left out. `limit` defaults to 10 and stops at 20.

`price` and `stockQuantity` are today's, for the option the customer last bought (`variantId`, `variantName`). A product that can't be bought stays in the list with `available: false` and `unavailableReason`, so the app can label it. To buy one that is available, set the cart quantity with `PUT /cart/items/:productId` and that `variantId` (use case 6), using `lastQuantity` as the starting quantity.

```json
GET /orders/again → 200
{ "success": true, "data": [
  { "productId": 3, "variantId": 3, "variantName": "White", "name": "48\" Ceiling Fan", "sku": "FAN001",
    "imageUrl": "store/assets/catalog/…", "categoryId": 3, "unit": "unit",
    "price": 199, "stockQuantity": 68, "stockStatus": "in_stock", "minOrderQuantity": 1,
    "lastQuantity": 1, "lastOrderedAt": "2026-06-17T13:03:37Z",
    "available": true, "unavailableReason": null },
  { "productId": 8155, "name": "ABB 16A Socket 2 Pin", "sku": "TXE-ELEC-SOK-008037",
    "price": null, "stockQuantity": 81, "stockStatus": "in_stock", "available": false,
    "unavailableReason": "This product isn't available to order right now." } ] }
```

`variantId` is the option they last bought, and `stockQuantity` is that option's stock today. `variantName` is its name, such as "White". An option that was switched off comes back unavailable with "This option isn't available to order right now." The same three product reasons are used otherwise: "This product is no longer sold.", "This product isn't available to order right now.", and "This product is out of stock."

**App rules:**
- Draw only the section types you know, in the order given, and skip `enabled: false`.
- What a banner tap opens depends on `ctaType`:
  - `category`: `ctaTarget` is a category ID.
  - `product`: a product ID.
  - `deals`: the deals list.
  - `external` or `url`: an outside link.

### UC-2 Categories, subcategories, brands

**Calls, all public:** `GET /catalog/categories`, `GET /catalog/subcategories`, `GET /catalog/brands`.

```json
GET /catalog/categories → 200
{ "success": true, "data": [ { "id": 1, "slug": "ELEC", "name": "Electrical Appliances",
  "imageUrl": "store/assets/catalog/Switches & Sockets/extension-board.webp", "description": "Electrical devices and appliances",
  "displayOrder": 1, "productCount": 0, "featured": 1 } ] }

GET /catalog/subcategories → 200
{ "success": true, "data": [ { "id": 87, "categoryId": 19, "slug": "MOTION_SENSORS", "name": "Motion Sensors",
  "searchTerm": "Motion Sensors", "imageUrl": "", "displayOrder": 1 } ] }

GET /catalog/brands → 200
{ "success": true, "data": [ { "id": "Havells", "name": "Havells", "productCount": 8589 } ] }
```

A brand's `id` is its name. Pass it as `brandId` when listing products.

### UC-3 Search and product lists

**Call, public:** `GET /catalog/products`. All filters are optional and can be combined:

| Query | Meaning |
|---|---|
| `search` | Text in the name or description |
| `categoryId` | Category ID |
| `subcategoryId` | Subcategory ID |
| `brandId` | Brand name from `GET /catalog/brands` |
| `featured=true` | Featured only |
| `page`, `limit` | Paging. `limit` defaults to 50, maximum 200 |

```json
GET /catalog/products?search=bulb&limit=2 → 200
{ "success": true,
  "data": [ { "id": 5, "sku": "LIGHT001", "name": "9W LED Bulb", "description": "9W LED bulb equivalent to 60W …",
    "categoryId": 4, "categoryName": "Lighting", "subcategoryId": 10, "brandName": "BrightLED",
    "imageUrl": "store/assets/catalog/…", "stockStatus": "in_stock", "minOrderQuantity": 1, "maxOrderQuantity": 50, "quantityStep": 1,
    "featured": 1, "createdAt": "2026-01-16T18:30:00.000Z", "price": "149.00", "originalPrice": "199.00",
    "unit": "unit", "stockQuantity": 500 } ],
  "meta": { "page": 1, "limit": 2, "total": 2720, "totalPages": 1360 } }
```

**App rules:**
- `price: null` means the product can't be bought. Show it as unavailable and block Add to cart.
- `stockStatus: "out_of_stock"` or `stockQuantity: 0` means it can't be added either.

### UC-4 Product detail and the price for a quantity

**Calls, all public:**
- `GET /catalog/products/:id`. This is the same product, plus `gallery`, its active `bulkTiers`, `variants`, `highlights` and `specifications`. `quantityStep` is the pack size. `1` means any whole number from `minOrderQuantity`. `6` means 6, then 12, then 18, and the first pack is the higher of the minimum and 6. The cart refuses any other quantity. Each variant is one option: `id`, `name`, `sku`, `stockQuantity`, `stockStatus`, `price`, `available`. The first option is the one a cart call uses when it does not send `variantId`. `price` on the product is still the lowest price stored against the product. An option with no price of its own uses that. On the 48" ceiling fan, White (id 3) has its own price of ₹199, so a cart that leaves `variantId` out sells White at ₹199. Brown and Black use the product price of ₹1,999. `available` is false when the option is switched off, unpriced, or out of stock. `stockQuantity` on the product and on each option is the company figure. The phone does not send a store, so the product page and the cart keep showing that figure. When staff have set a quantity for the store that serves the checkout pincode, checkout sells only that quantity, and never more than the company figure. A store with no quantity of its own sells the company figure. Empty on the product screen means company stock. `0` means that store has none. The stores together cannot hold more than the company figure. `highlights` is a list of short points. `specifications` is a list of `{ "label", "value" }`. Both start empty until staff fill them on the product screen. Draw nothing when a list is empty. A product can have 8 highlights of 160 characters, and 16 specifications (name 80, value 160).
- `GET /pricing/calculate?productId=&quantity=` gives the exact price for a quantity, worked out from the product's own price.

```json
GET /catalog/products/5 → 200
{ "success": true, "data": { "id": 5, "name": "9W LED Bulb", "price": "149.00", "originalPrice": "199.00",
  "minOrderQuantity": 1, "maxOrderQuantity": 50, "quantityStep": 1, "stockQuantity": 500, "unit": "unit", "gallery": "",
  "variants": [
    { "id": 6, "name": "Warm White", "sku": null, "stockQuantity": 500, "stockStatus": "in_stock", "price": 149, "available": true },
    { "id": 7, "name": "Cool White", "sku": null, "stockQuantity": 400, "stockStatus": "in_stock", "price": 149, "available": true } ],
  "highlights": [],
  "specifications": [],
  "bulkTiers": [ { "id": 4, "minQty": 25, "maxQty": 99, "discountType": "percentage", "discountValue": "10.00",
                   "terms": "Contractor box pack rate." } ] } }

GET /pricing/calculate?productId=5&quantity=30 → 200
{ "success": true, "data": { "basePrice": 149, "unitPrice": 134.1, "discountPercent": 10, "discountPerUnit": 14.9,
  "subtotal": 4023, "totalSavings": 447,
  "appliedTier": { "id": 4, "minQty": 25, "maxQty": 99, "discountValue": 10, "discountType": "percentage",
                   "terms": "Contractor box pack rate." } } }
```

**Refusals:** `400` when `productId` or `quantity` isn't a whole number of at least 1. `404` with "That product isn't available to order right now." when it has no price.

**Bulk prices:** a bulk price has a `discountType`:
- `percentage`: `discountValue` is the percent off.
- `fixed_price`: `discountValue` is the unit price in rupees.

When several cover a quantity, the server uses the one with the lowest unit price. Use `/pricing/calculate` or the cart rather than choosing in the app. Any `basePrice` the app sends is ignored.

### UC-5 Delivery pincode check

**Call, public:** `GET /delivery/pincodes/:pincode`.

```json
GET /delivery/pincodes/201301 → 200
{ "success": true, "data": { "pincode": "201301", "serviceable": true, "areaName": "Sector-62",
  "message": "We deliver to Sector-62 (201301)." } }

GET /delivery/pincodes/110001 → 200
{ "success": true, "data": { "pincode": "110001", "serviceable": false, "areaName": null,
  "message": "We don't deliver to 110001 yet." } }

GET /delivery/pincodes/12 → 400
{ "success": false, "error": "Enter a 6-digit pincode." }
```

Checkout checks the pincode again, so this is for showing the customer early.

### UC-6 Guest cart

The cart lives on the server for guests and signed-in customers alike. Its totals are what checkout charges.

1. **Get the cart.** `GET /cart` with no token and no `x-session-id` creates a guest cart and returns its `sessionId`. Save it on the device. Every cart call after that sends `x-session-id: <sessionId>`.
2. **Set a quantity.** `PUT /cart/items/:productId` with `{ "quantity": 30 }`. Add `"variantId": 7` to sell that option. Leave `variantId` out and the server uses the product's first option, so an app that does not choose yet keeps working.
   - This sets the exact quantity; it doesn't add to it.
   - `0` with no `variantId` removes every option of that product. `0` with a `variantId` removes only that option.
   - A line includes `variantId` and `variantName`. `limits` is `{ min, max, stock, step }`. `step` is the pack size, the same number as `quantityStep` on the product. The cart stepper should use `step`.
   - Every answer is the whole priced cart.
3. **Empty the cart.** `DELETE /cart`.

```json
PUT /cart/items/5  { "quantity": 30 }  → 200
{ "success": true, "data": {
  "id": 115, "sessionId": "86ba5845…",
  "lines": [ { "productId": "5", "variantId": 6, "variantName": "Warm White", "name": "9W LED Bulb", "brandName": "BrightLED", "categoryId": "4",
    "imageUrl": "store/assets/catalog/…", "unit": "unit", "quantity": 30, "basePrice": 149, "unitPrice": 134.1,
    "appliedTier": { "id": 4, "minQty": 25, "maxQty": 99, "discountValue": 10, "discountType": "percentage",
                     "terms": "Contractor box pack rate." },
    "lineTotal": 4023, "limits": { "min": 1, "max": 50, "stock": 500 }, "problem": null } ],
  "totals": { "subtotal": 4023, "bulkSavings": 447, "delivery": 0, "tax": 724.14, "grandTotal": 4747.14 },
  "canCheckout": true } }
```

**Refusals when setting a quantity:**

| Status | `error` |
|---|---|
| 409 | `You can order up to 50 of "9W LED Bulb".` |
| 409 | `Only 12 of "…" are in stock.` |
| 409 | `"…" must be ordered in quantities of at least 5.` |
| 409 | `"…" is not available to order right now.` (no price) or `"…" is out of stock.` |
| 409 | `This product is no longer in the catalogue.` |
| 400 | `Quantity must be a whole number of 0 or more.` |
| 400 | `variantId must be a variant number.` |
| 400 | `That option isn't part of this product.` |
| 409 | `This option isn't available to order right now.` |

**A line's `problem`:** a line already in the cart can go bad after a price or stock change.
- `problem` is then `price_unavailable`, `out_of_stock` or `over_limit`, and the line is left out of `totals`.
- `canCheckout` is false until the customer fixes or removes it.
- Show `limits` so they can.

### UC-7 Sign in with a one-time code

1. `POST /auth/send-otp` with `{ "phone": "9876543210" }`.
2. `POST /auth/verify-otp` with `{ "phone": "9876543210", "otp": "123456", "name": "Asha Verma", "email": "asha@example.com" }`. `name` and `email` are optional.

```json
POST /auth/send-otp → 200
{ "success": true, "data": { "phone": "9876543210", "message": "OTP sent successfully to +91 9876543210",
  "devOtp": "123456" }, "message": "OTP sent successfully to +91 9876543210" }

POST /auth/verify-otp → 200
{ "token": "eyJhbGciOi…", "user": { "id": "42", "name": "Asha Verma", "email": "asha@example.com",
  "mobile": "9876543210", "deliveryLocation": { "pincode": "201301", "city": "Noida" } } }
```

**Refusals:**
- `400` "Phone and OTP are required".
- `401` "That code is wrong or has expired. Ask for a new one."

**Notes:**
- A code lasts 10 minutes.
- Verifying a new phone number creates the customer.
- `devOtp` only exists locally.
- The local-only shortcut `POST /auth/login` with `{ "identifier": "9876543210" }` returns the same `{ token, user }` for an existing customer, with no code.

**Profile:** `GET /auth/me` (signed in) returns:

```json
{ "id", "name", "email", "mobile", "createdAt", "deliveryLocation": { "pincode", "city" } }
```

### UC-8 Move the guest cart into the account after sign-in

`POST /cart/merge`, signed in, with `{ "sessionId": "<the saved guest sessionId>" }`. The answer is the account's priced cart.

**Rules:**
- Where both carts have the same option, the larger quantity is kept, limited to the maximum and that option's stock. Different options of one product stay as separate lines. Quantities aren't added together.
- The guest cart is then closed, so forget the saved `sessionId`.
- From now on, cart calls send the Bearer token and no `x-session-id`.

### UC-9 Saved addresses (signed in)

| Call | Body | Gives |
|---|---|---|
| `GET /auth/addresses` | | The list, default first |
| `POST /auth/addresses` | `{ "label": "Home", "flatNo", "building", "area", "city", "pincode", "isDefault": true }` | The new address, 201. `flatNo`, `area`, `city` and `pincode` are required |
| `PUT /auth/addresses/:id/default` | | Makes it the default |
| `DELETE /auth/addresses/:id` | | Removes it |

```json
GET /auth/addresses → 200
{ "success": true, "data": [ { "id": 7, "userId": 42, "label": "Home", "flatNo": "B-204", "building": "Lotus Towers",
  "area": "Sector 62", "city": "Noida", "pincode": "201301", "lat": null, "lng": null, "isDefault": 1 } ] }
```

### UC-10 Checkout (cash on delivery)

`POST /cart/checkout` with the cart's headers (Bearer token, or `x-session-id` for guests).

The cart still shows the company stock, because a pincode is not known yet. Checkout uses the store that serves the pincode. If staff have set a quantity for that store, the order can take only that many, and never more than the company figure. The same "only N are in stock" refusal covers it. Cancelling the order puts the quantity back on that store as well as on the company stock.

`GET /shop/rules` is public. `deliveryFee`, `freeDeliveryFrom` and `gstPercent` are the numbers the cart uses. A null value means that rule is switched off. `largeOrderValue` and `largeOrderQuantity` are the amounts at which checkout places the order as `pending` and holds the stock. `codLimit` is the cash total above which checkout refuses the order. Null means that rule is off. The cart total is still the amount to charge. Do not add the fee or the tax again on the phone.

| Field | Required | Notes |
|---|---|---|
| `expectedTotal` | **yes** | The `totals.grandTotal` the customer saw. A mismatch is refused, so they never pay a total they didn't see |
| `cartId` | recommended | The `id` of the cart shown. With it, a retry after a timeout returns the same order instead of failing |
| `addressId` | signed in | A saved address ID (use case 9) |
| `shippingAddress` + `pincode` | guests, or no saved address | The full address text and its 6-digit pincode |
| `guestName`, `guestPhone`, `guestEmail` | guests | Stored on the order |
| `paymentMethod` | no | Only `"COD"`, which is the default |
| `notes` | no | Free text |

```json
POST /cart/checkout
{ "cartId": 115, "expectedTotal": 2710.46, "pincode": "201301",
  "shippingAddress": "B-204 Lotus Towers, Sector 62, Noida 201301", "guestName": "Asha Verma", "paymentMethod": "COD" }

→ 201 (a repeat for the same cart → 200, "Order already placed", same body)
{ "success": true, "message": "Order placed", "data": {
  "id": "12", "orderNumber": "TX-ORD-551492-390", "placedAt": "2026-10-23T10:32:31.000Z", "status": "confirmed",
  "paymentStatus": "pending", "paymentMethod": "COD", "customerName": "Asha Verma",
  "deliveryAddress": "B-204 Lotus Towers, Sector 62, Noida 201301",
  "lines": [ { "productId": "5", "name": "9W LED Bulb", "unit": "unit", "quantity": 2, "unitPrice": 149, "lineTotal": 298 },
             { "productId": "3", "name": "48\" Ceiling Fan", "unit": "unit", "quantity": 1, "unitPrice": 1999, "lineTotal": 1999 } ],
  "totals": { "subtotal": 2297, "bulkSavings": 0, "delivery": 0, "tax": 413.46, "grandTotal": 2710.46 },
  "total": 2710.46, "shippingCharges": 0 } }
```

**Refusals.** Nothing is ordered and the cart is unchanged:

| Status | `error` | What the app does |
|---|---|---|
| 400 | `expectedTotal is required: the total shown to the customer.` | Send it |
| 400 | `Only cash on delivery is available.` | Send `COD` |
| 400 | `Your cart is empty.` | Back to the cart |
| 409 | `Prices changed since you opened checkout. Check the new total and place the order again.` | Reload the cart, show the new total, ask again |
| 409 | `We don't deliver to 110001 yet.` | Ask for another address |
| 409 | A line's limit or stock sentence, as in use case 6 | Back to the cart |
| 409 | `Cash on delivery stops at ₹…. This order is ₹….` | The cash limit is on and this total is above it. Nothing is ordered |
| 409 | `This cart was moved to your account. Open the cart again.` | Reload the cart with the token |
| 503 | `We couldn't place your order. Your cart is unchanged.` | Offer a retry with the same `cartId` |

**Effects:**
- An order takes its stock at once. It starts as `confirmed`, unless it is at or above a switched-on large-order value or a switched-on quantity on one line. Then `status` is `pending`, `awaitingStaff` is true, and `message` says staff still have to confirm it. The goods stay held. Staff confirm it in the portal, or cancel it to put the stock back. `GET /shop/rules` shows the thresholds; null means that rule is off.
- **Guests:** if `guestPhone` is a 10-digit number with no account, a new customer is created for it. If the number already has an account, the order stays a guest order and the account isn't touched.

### UC-11 My orders

| Call | Notes |
|---|---|
| `GET /orders` | Signed in only; without a sign-in it's `401` "Sign in to see your orders." Returns the customer's own orders, newest first, each without `history`. Paging: `page`, `limit` (default 50, maximum 100); filter: `status` |
| `GET /orders/:id` | The same order plus `history`. Someone else's order is `403` |

```json
GET /orders/5 → 200
{ "success": true, "data": {
  "id": 5, "orderNumber": "TX-ORD-303276-897", "userId": 42, "placedAt": "2026-10-16T22:01:43Z",
  "status": "confirmed", "paymentStatus": "paid", "paymentMethod": "UPI",
  "total": 265500, "subtotal": 225000, "taxTotal": 40500, "deliveryCharge": 0, "discountTotal": 0,
  "deliveryAddress": "B-204 Lotus Towers, Sector 62, Noida 201301", "storeId": 1, "storeName": "Bhutani Tower Store",
  "customerName": "Asha Verma", "customerMobile": "9876543210", "customerEmail": "asha@example.com",
  "items": [ { "id": 19, "productId": 1, "variantId": 1, "name": "1.5 Ton Split AC", "sku": "AC001", "quantity": 5,
               "unitPrice": 45000, "lineTotal": 225000, "unit": "unit" } ],
  "history": [ { "id": 3, "status": "confirmed", "paymentStatus": "paid", "notes": "Please call upon arrival at gate 2",
                 "date": "2026-10-15T18:30:00.000Z", "time": "22:01:43" } ] } }
```

Older imported orders can show other payment methods. A history `date` is a full timestamp, so read only its date part and pair it with `time`.

**Statuses** come from staff in the portal: `pending`, `confirmed`, `processing`, `shipped`, `delivered`, `cancelled`.
- Cancelled is final.
- A delivered order can't be cancelled.
- Customers can't cancel from the app yet; there is no endpoint for it.

**Order again:** `GET /orders/again` (use case 1). It is not the same as reading `GET /orders` and using the old line prices.

**Reorder one order into the cart:** `POST /cart/reorder` with `{ "orderId": 1 }`. Signed in only; without a sign-in it's `401` "Sign in to reorder an order." It adds that order's quantities on top of the cart, for the option that was bought, at today's price and that option's stock, and does not place a new order. Calling it again adds them again.

- `added` is what landed in the cart. `quantity` is the line's new total. `note` is set when less than the ordered amount could be added (stock, a maximum, or a minimum).
- `skipped` is what was left unchanged, each with a `reason`.
- Someone else's order, or an unknown one, is `404` "Order not found." A bad `orderId` is `400`.
- `cart` is the priced cart from use case 6.

```json
POST /cart/reorder  { "orderId": 1 } → 200
{ "success": true, "data": {
  "added": [ { "productId": 5, "variantId": 6, "name": "9W LED Bulb (Warm White)", "quantity": 3, "note": null } ],
  "skipped": [ { "productId": 1, "name": "1.5 Ton Split AC", "reason": "This product is no longer in the catalogue." } ] } }
```

The same object also includes `cart`, the priced cart from use case 6. In this example the bulb's 3 were the ordered quantity on an empty cart, and the air conditioner is no longer sold so it was not added.

### UC-12 Saved items

The list follows the account, so it is still there after a reinstall or on another phone. A guest list is kept against the same `x-session-id` as the cart. Saving a product that is already saved moves it to the front. Newest first. At most 100 products.

| Call | Notes |
|---|---|
| `GET /wishlist` | The caller's saved products, at today's price and stock. A guest with no session gets a new `sessionId` and an empty list; send that id from then on |
| `PUT /wishlist/:productId` | Body `{ "saved": true }` or `{ "saved": false }`. `saved` must be a boolean |
| `POST /wishlist/merge` | Signed in. Body `{ "sessionId", "productIds" }`. Folds the guest session and the ids saved on the device into the account, then clears the guest session |

```json
PUT /wishlist/5  { "saved": true } → 200
{ "success": true, "data": {
  "sessionId": "…",
  "items": [ { "productId": 5, "name": "9W LED Bulb", "price": 149, "available": true, "unavailableReason": null } ] } }
```

Each item also includes `sku`, `imageUrl`, `categoryId`, `brandName`, `unit`, `stockQuantity`, `stockStatus`, `minOrderQuantity` and `variantId`, the same facts as a product in the catalogue.

A signed-in response has no `sessionId`. A product that can no longer be bought stays in the list with `available: false` and `unavailableReason`, the same three sentences as Order Again.

**Refusals:**

| Status | `error` |
|---|---|
| 400 | `saved must be true or false.` |
| 400 | `productId must be a product number.` |
| 400 | `productIds must be a list of product numbers.` |
| 401 | `Sign in to keep your saved items.` on merge, when there is no customer sign-in |
| 409 | `This product is no longer in the catalogue.` when saving a product that is not on sale |
| 409 | `You can save up to 100 products. Remove one to save another.` |

**After sign-in**, send the device's saved ids too, newest first. They are kept ahead of the guest session and the account, duplicates are dropped, and anything past 100 is the oldest and is left out.

```json
POST /wishlist/merge  { "sessionId": "…", "productIds": [8155, 5] } → 200
{ "success": true, "data": { "items": [
  { "productId": 8155, "name": "ABB 16A Socket 2 Pin", "price": null, "available": false,
    "unavailableReason": "This product isn't available to order right now." },
  { "productId": 5, "price": 149, "available": true, "unavailableReason": null },
  { "productId": 3, "price": 1999, "available": true, "unavailableReason": null } ] } }
```

The second example is shortened to the fields that decide what the screen shows. The socket has stock but no price, so it stays saved and is not for sale.

### UC-20 Talk to us

**Call, public:** `POST /shop/requests`. The customer asks staff to look at a cart. Nothing is ordered and no stock is held. The same price, GST, delivery fee and pincode rules as checkout apply. A quantity above the stock, or above the shelf limit, is accepted and staff see why. A missing price, a broken pack and an area we don't deliver to are refused with the same sentences as the cart.

```json
POST /shop/requests
{ "name": "Ravi Kumar", "phone": "9999999999", "pincode": "201301",
  "note": "Need this next week",
  "lines": [ { "productId": 3, "variantId": 3, "quantity": 100 } ] }
```

`variantId` may be left out. That sells the first option, as the cart does. Two lines for the same option are added together. Up to 30 products.

```json
200 → { "success": true, "data": {
  "id": "1", "status": "new",
  "message": "Staff will call this number. Nothing is ordered, and no stock is held.",
  "totals": { "subtotal": 0, "tax": 0, "delivery": 0, "grandTotal": 0 } } }
```

The totals in a real answer are the priced cart. Show `message`. Do not take the customer to an order screen.

| Status | `error` |
|---|---|
| 400 | `Enter the customer's name.` / `Enter a 10-digit mobile number.` / `Add a 6-digit pincode.` / `Add at least one product.` |
| 409 | `We don't deliver to 110001 yet.` or a pack, price or catalogue sentence |
| 503 | `We couldn't send that request. Nothing was saved.` |

### UC-13 Help and support

**Call, public:** `GET /cms/help`. The phone number, WhatsApp number, email, working hours and questions. All of them are blank until staff fill them in on the portal (Help & support). The app can keep its current copy until it switches to this call.

```json
GET /cms/help → 200
{ "success": true, "data": {
  "phone": "", "phoneLabel": "", "whatsapp": "", "email": "", "hours": "", "faqs": [] } }
```

When a question is published it has `id`, `question`, `answer` and `position` (1 is first). `phone` and `whatsapp` are digits the app can dial or open in WhatsApp, with an optional leading `+`. `phoneLabel` is the number as a person should read it.

### UC-14 Home shortcuts and projects

**Call, public:** `GET /cms/home`. The category row under the header, and the Shop by project tiles. Both lists are empty until staff fill them on the portal (Shortcuts & projects, same access as Home screen sections). The app can keep its own lists until it switches to this call. Match `categoryId` to `id` from `GET /catalog/categories` by comparing them as text, because the catalogue id arrives as a number.

The app still draws **More** as the last shortcut. This call never includes it, and it holds at most 7 shortcuts.

A shortcut's `label` is the short name staff typed. When it is `""`, show `name`. Skip a row with `available: false` (the category was taken off sale after it was chosen). `imageUrl` is the category's picture.

A project opens its own page. `categories` is the list for that job, in the order staff set. Skip a category with `available: false`. `calculator` is `""`, `paint`, `tiles` or `cement`: the same estimators the app already has. `""` means no estimator button. `imageUrl` may be blank. A project's `id` can change the next time staff save the page, so open a project from the latest response.

```json
GET /cms/home → 200
{ "success": true, "data": { "shortcuts": [], "projects": [] } }
```

### UC-15 Search ideas

**Call, public:** `GET /cms/search-suggestions`. The chips under the home search box, in the order staff set. The list is empty until staff fill it on the portal (Shortcuts & projects, same access as Home screen sections). The app can keep its own list (Cement, Wall putty, and the rest) until it switches to this call. Draw nothing extra when the list is empty. Eight ideas, each 40 characters. The same idea cannot appear twice.

```json
GET /cms/search-suggestions → 200
{ "success": true, "data": { "suggestions": [] } }
```

A published idea is one string, such as `"LED bulbs"`. Saving replaces the whole list. Leaving `suggestions` out of the save is refused, so an empty body cannot clear the list by accident. An empty list does clear it.

### UC-16 Trust strip

**Call, public:** `GET /cms/trust`. The claims under the banners, in the order staff set. The list is empty until staff fill it on the portal (Home screen sections, same access as the layout). The app can keep its own four claims until it switches to this call. Draw nothing when the list is empty. Four claims, each 32 characters. The same words cannot appear twice.

```json
GET /cms/trust → 200
{ "success": true, "data": { "claims": [] } }
```

A published claim has `label`, `icon`, `action` and `position` (1 is first). `icon` is `truck-fast-outline`, `shield-check-outline`, `tag-outline` or `headset`. `action` is what a tap opens:

- `delivery`: the delivery location screen.
- `about`: About us.
- `help`: Help and support.
- `phone`: call the number from `GET /cms/help`. When that number is blank, open Help.

Saving replaces the whole list. Leaving `claims` out of the save is refused, so an empty body cannot clear the strip by accident. An empty list does clear it.

### UC-17 About the company

**Call, public:** `GET /cms/about`. The mission, facts and values on About us. The page is empty until staff fill it on the portal (About the company). The app can keep its own mission, facts and values until it switches to this call. Draw a heading only when `missionTitle` has words, a paragraph only when `missionBody` has words, and nothing for an empty list. The company name, certification and website stay the app's own copy.

```json
GET /cms/about → 200
{
  "success": true,
  "data": { "missionTitle": "", "missionBody": "", "facts": [], "values": [] }
}
```

A fact has `value`, `label` and `position` (1 is first). Four facts fill the row. A figure is 16 characters, a name 32. The same name cannot appear twice.

A value has `icon`, `title`, `body` and `position`. Six is the most. A title is 40 characters, a description 240. `icon` is `ribbon-outline`, `bulb-outline`, `heart-outline`, `shield-checkmark-outline`, `people-outline` or `leaf-outline`. The same title cannot appear twice.

The mission heading is 80 characters, the paragraph 600. Saving replaces the whole page. An empty body clears it. A fact row needs both a figure and a name; a value row needs a title, a description and one of those symbols.

### UC-18 Policies

**Call, public:** `GET /cms/policies`. Privacy, terms, cancellation and shipping, in that order. Each page is empty until staff paste the published text on the portal (Policies). The app can keep its own privacy and terms until it switches to this call. When `intro` and `sections` are both empty, show the same "being prepared" notice the app already uses, and do not invent text. Draw "Last updated" only when `lastUpdated` has words. Draw "View on website" only when `sourceUrl` has a link.

```json
GET /cms/policies → 200
{
  "success": true,
  "data": {
    "policies": [
      { "id": "privacy", "title": "Privacy policy", "lastUpdated": "", "sourceUrl": "", "intro": [], "sections": [] },
      { "id": "terms", "title": "Terms & Conditions", "lastUpdated": "", "sourceUrl": "", "intro": [], "sections": [] },
      { "id": "cancellation", "title": "Cancellation & Refunds", "lastUpdated": "", "sourceUrl": "", "intro": [], "sections": [] },
      { "id": "shipping", "title": "Shipping & Delivery", "lastUpdated": "", "sourceUrl": "", "intro": [], "sections": [] }
    ]
  }
}
```

`id` is `privacy`, `terms`, `cancellation` or `shipping`. `title` is fixed. A section has `heading` and `blocks`. A block is a paragraph (a string) or a list of points (an array of strings), which is the same shape the policy screen already draws. Six opening paragraphs, 24 sections, 16 blocks in a section, 20 points in a list. A paragraph is 800 characters, a point 400, a heading 120.

Saving one policy replaces that policy only. `intro` and `sections` must both be sent, so an empty body cannot clear a page by accident. Sending both as empty lists does clear that page. The other three stay as they were.

### UC-19 Deals tiles

**Call, public:** `GET /cms/deals`. The two tiles under Deals for You, in the order staff set. The list is empty until staff pick categories on the portal (Shortcuts & projects, same access as the home layout). The app can keep its own two tiles until it switches to this call. Draw nothing when the list is empty. Skip a tile with `available: false`.

```json
GET /cms/deals → 200
{ "success": true, "data": { "deals": [] } }
```

A tile has `categoryId`, `name`, `available`, `title`, `highlight`, `tagline`, `tone`, `imageUrl` and `position` (1 is first). Tapping it opens that category. `tone` is `peach` or `navy`. Draw `highlight` only when it has words. `tagline` is the short line under the title. There is no discount on this tile; do not invent one. `imageUrl` is the picture staff set. When it is blank, use the category's own picture. Two tiles fill the row. The same category cannot appear twice.

Saving replaces this row only. Leaving `deals` out of the save is refused, so an empty body cannot clear the row by accident. An empty list does clear it. The shortcut row, project tiles and search ideas are separate calls.

---

## 9. Calls the app should not use

| Call | Why |
|---|---|
| `POST /orders`, `POST /cart/items`, `DELETE /cart/items/:id`, `GET /cart/summary` | Older forms kept for old clients. Use `POST /cart/checkout`, `PUT /cart/items/:productId` and `GET /cart` |
| `POST /auth/login` | Local only (section 6) |
| Anything under `/auth/admin`, `/access`, `/stores`, `/audit`, `/orders/stats`, `?all=true`, or any POST, PUT or DELETE on catalogue, CMS, pricing or delivery | Staff portal only; needs a staff sign-in |

## 10. Must be fixed before the app goes live

Each item was found while writing this guide. They are for the app team unless marked as server.

- **Sign-in:** the app signs in with `POST /auth/login`, which production refuses. Move it to use case 7 (send and verify a code).
- **Server: no SMS is sent.** In production the code is random but nothing delivers it yet, so an SMS provider has to be added to `AuthService.sendOtp` before launch.
- **Order statuses:** the app's status list (`placed`, `packed`, `out_for_delivery`, `returned`…) doesn't match the server's six (use case 11).
- **Images:** product and category images are relative paths that no server hosts (section 5).
- **Pack size on the cart screen:** product detail already reads `quantityStep`. The cart screen still keeps the step it stored when the line was added, which is 1 until it reads `limits.step`.
- **Store stock:** the product page and the cart show the company figure. Checkout already applies a store quantity when staff have set one for the pincode's store. The phone does not need a new field for that.
- **Home:** the app still uses its own shortcut and project lists, whose category ids are not in this catalogue, so those blocks stay empty until it reads `GET /cms/home` (use case 14). The search chips are still the app's own list until it reads `GET /cms/search-suggestions` (use case 15). The trust strip is still the app's own four claims until it reads `GET /cms/trust` (use case 16). About us still uses the app's own mission, facts and values until it reads `GET /cms/about` (use case 17). Privacy and terms are still the app's own copies, and cancellation and shipping are still blank, until it reads `GET /cms/policies` (use case 18). The deals tiles are still the app's own two cards until it reads `GET /cms/deals` (use case 19). Banners can't open outside links yet (use case 1).
- **Sign-in after an app restart:** the token is held in memory only. Store it securely so the customer stays signed in for its 30 days.

## 11. Troubleshooting

| You see | Likely cause |
|---|---|
| App says "not connected" | `EXPO_PUBLIC_API_BASE_URL` is empty or Expo wasn't restarted with `-c` |
| Requests time out from a phone | It used `localhost`; use the computer's LAN IP, same Wi-Fi, and allow Node through the firewall |
| `/health` returns 503 or `"degraded"` | MySQL is stopped, the password in `server/.env` is wrong, or a database is missing |
| `Database unavailable (…)` errors | Same as above |
| Every product shows "unavailable" | It has no price. Give it one in the portal (Products → Edit) |
| Checkout says "We don't deliver to …" | Add the pincode in the portal (Delivery pincodes) and link it to a store (Stores & groups) |
| Sign-in token refused after restarting the API | `JWT_SECRET` changed. Sign in again |
