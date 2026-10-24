# Shop track — cart, pincode, order (no payment)

The portal plan (P7–P11 in [`WEB_SPEC.md`](./WEB_SPEC.md)) is built. This track makes the phone shop against the server: the server owns prices, the cart, where it delivers, and the order. Payment, refunds, invoices, a customer website and ERP stay out.

**Rule:** finish and verify each step before the next.

| Step | What it delivers | Done when | Status |
| --- | --- | --- | --- |
| **S0** | The server decides prices at checkout | A request with a made-up `unitPrice` is charged the catalogue price; a product with no active price is refused | **Done** |
| **S1** | Server cart for every customer | Cart survives an app restart, guest cart moves into the account on sign-in, totals on the Cart screen come from the server | **Done** (device run pending) |
| **S2** | Pincode serviceability | Only pincodes active in `pincodes` can be delivered to; the phone says so before checkout | **Done** (device run pending) |
| **S3** | Place the order from the server cart (cash on delivery) | `/cart/checkout` turns the server cart into an order; a database error never produces a pretend order | **Done** (device run pending) |

## What exists (23 Oct 2026)

- The phone cart (`app/src/state/cartStore.ts`) is in memory only. Checkout posts items and the phone's prices to `POST /orders`.
- The server has `/cart`, `/cart/items`, `/cart/summary` and `/cart/checkout` for a signed-in user or a guest `x-session-id`. Nothing calls them, and there is no way to set a line's quantity.
- `OrderService.checkout` uses `item.unitPrice` when the phone sends one, and sells products with no price at ₹450.
- `pincodes` holds one active row (201301, Sector-62). Nothing reads it.
- Tax is 18%; delivery is ₹99 under ₹2,000 subtotal, free from ₹2,000.

## S0 — server prices at checkout

- `OrderService.checkout` ignores any client `unitPrice`. The base price is the product's active `product_pricing.SellingPrice`; bulk tiers apply on top through `PricingService.calculateBulkPrice`.
- A product without an active price is refused: `"<name>" is not available to order right now` (HTTP 409). Checkout no longer falls back to ₹450; the cart reads lose that fallback in S1.
- A product that is no longer in the catalogue, too little stock, or an empty order is also a 409/400 refusal with a sentence the phone shows. Refusals are never turned into a "database unavailable" error or a file-store order.
- The phone stops sending `unitPrice`.

Verified 23 Oct 2026 against the local store database: an order for product 1 sent with `unitPrice: 1` was charged ₹45,000 (its selling price); a product with no active price and a missing product were refused with 409. The proof order was then deleted and its one unit of stock put back.

## S1 — server cart

**Who owns which cart**

- Signed in: the active cart for the user's ID.
- Guest: the server creates the cart on the first `GET /cart` without a session and returns a `sessionId` (32 random bytes, hex, generated on the server). The phone keeps it on the device and sends it as `x-session-id`. A session ID shorter than 32 characters is ignored.
- The phone never sends `cartId`; the server resolves the caller's cart.

**API**

- `GET /cart` → the priced cart:

  ```json
  {
    "sessionId": "…only for guests…",
    "lines": [{
      "productId": "1204", "name": "…", "imageUrl": "…", "unit": "bag",
      "quantity": 20, "basePrice": 450, "unitPrice": 414, "appliedTier": { "minQty": 10, "maxQty": 49, "discountType": "percentage", "discountValue": 8 },
      "lineTotal": 8280,
      "limits": { "min": 1, "max": 100, "stock": 240 },
      "problem": null
    }],
    "totals": { "subtotal": 8280, "bulkSavings": 720, "delivery": 0, "tax": 1490.4, "grandTotal": 9770.4 },
    "canCheckout": true
  }
  ```

  `problem` is `null`, `"out_of_stock"`, `"price_unavailable"` or `"over_limit"`. Lines with a problem stay in the cart, are left out of the totals, and set `canCheckout` to `false`.
- `PUT /cart/items/:productId` with `{ "quantity": n }` sets the exact quantity (0 removes the line) and returns the priced cart. A quantity below the minimum, above the maximum or above stock is refused with 409 and a sentence the phone can show.
- `POST /cart/merge` (signed in) with `{ "sessionId" }` moves the guest lines into the account cart. Where both have the product, the larger quantity is kept, then limited to the product's maximum and stock. The guest cart is closed (`Status = 'merged'`).
- `/cart/summary`, `POST /cart/items`, `DELETE /cart/items/:id` and `DELETE /cart` keep working for now.

**Phone**

- `cartStore` keeps its exported functions so screens barely change; its state becomes a copy of the server cart plus totals.
- A tap changes the screen at once. Each line has at most one request in flight; while it is in flight only the newest wanted quantity is queued.
- A server reply replaces the cart, except lines that still have their own pending change.
- A refused change puts the line back at the server's quantity and shows the server's sentence.
- After sign-in the phone calls `/cart/merge`, then reloads. After sign-out it reloads the guest cart.
- With no API base URL the phone keeps today's memory-only cart.

**Tests**

- Unit tests (`npm test` in `server/`) for the quantity check, the merge rule and the totals.
- Manual run against the API: add, change and remove lines as a guest, sign in, merge, reload.

### S1 as built (23 Oct 2026)

- Rules: `server/src/utils/cartRules.ts`. Service: `CartService.view`, `setLineQuantity`, `mergeGuestCart`, `emptyCart`. `DELETE /cart` without `cartId` empties the caller's cart; the phone calls it after an order is placed.
- Stock for a line is that option's `product_variants.StockQuantity`, the same row checkout decrements. A cart call with no `variantId` still uses the first variant. Price is that option's selling price, or the product's lowest active price when the option has none. No ₹450 fallback.
- Phone: `services/cartApi.ts`, `state/cartSession.ts` (guest key in AsyncStorage as `techxpert.cartSession`), `state/cartStore.ts`, `components/store/CartSync.tsx` (mounted in the root layout). The Cart screen shows the server's subtotal, bulk savings, delivery, GST and total, marks lines with a problem, and disables checkout until they are fixed or a change is still saving.
- The sign-in session is still memory-only on the phone, so after an app restart a customer sees the device's guest cart until they sign in again; their account cart is merged back then.

Verified against the local store database and over HTTP on a spare port: a guest got a 64-character key; 25 of product 5 applied its 25+ tier (₹149 → ₹134.10, free delivery); above the order limit, a non-whole quantity, an unpriced product and a missing product were refused with a sentence; 0 removed the line; merge kept 3 over 2; merge without sign-in was 401; another key never saw the cart. All test carts were deleted afterwards.

**Known gaps for S3**

- The product page still shows ₹450 and 150 in stock when a product has no price or no inventory row (`catalogService` fallbacks). The cart refuses those with a clear sentence, but the product page should stop promising them.
- A product card's stock is still the first variant. The product page lists every option, and the cart sells the one it is given.

## S2 — pincode serviceability

**Decisions:** staff with Delivery edit (originally super_admin and admin; now a store-role permission, see [PORTAL_ACCESS.md](./PORTAL_ACCESS.md)) manage pincodes from a portal tab; delivery opened to 201301, 201309 and 201016.

**API** (`server/src/routes/delivery.ts`, `DeliveryAreaService`)

- `GET /delivery/pincodes/:pincode` (public) → `{ pincode, serviceable, areaName, message }`, e.g. "We deliver to Sector 62, Noida (201309)." or "We don't deliver to 110001 yet." A malformed pincode is 400 "Enter a 6-digit pincode." (6 digits, not starting with 0; spaces ignored).
- `GET /delivery/pincodes` (Delivery view) lists every pincode with its area and whether it is active.
- `POST /delivery/pincodes` `{ pincode, areaName }` and `PATCH /delivery/pincodes/:id` `{ active }` need Delivery edit. Adding reuses an area with the same name, otherwise creates one with code `P<pincode>` under the first district. A pincode already listed is 409. After a change the portal posts an audit entry with entity `delivery`.

**Checkout**

- The delivery pincode is the saved address's pincode, else the `pincode` field the phone sends, else the last 6-digit number in the typed address.
- No pincode is 400 "Add a 6-digit pincode to the delivery address."; an inactive or unlisted pincode is 409 with the "don't deliver" sentence. Guests are checked before anything is written.
- Address choice was fixed at the same time: an `addressId` wins, then the address typed at checkout, then the saved default. Checkout no longer invents a "Sector 62 … 201309" address when none is given; it refuses with 400.

**Phone:** `services/deliveryApi.ts` and `hooks/usePincodeCheck.ts` (300 ms debounce). The checkout screen shows "Checking delivery…", the deliver sentence, or the refusal under the pincode field, and will not place the order while checking or when the pincode is not served. The order request carries `pincode`.

**Portal:** "Delivery Pincodes" tab (`web/src/components/DeliveryPincodeManager.tsx`): counts, add form and pause/resume for Delivery edit; Delivery view alone sees the list read-only.

Verified 23 Oct 2026 against the local store database and over HTTP on a spare port: 201309 and 201016 were opened (rows 2 and 3); the public check answered for served, unserved and malformed pincodes; the list without sign-in was 401; an admin paused 201016 (the public check then said "don't deliver") and resumed it; a state manager's add and pause were 403; checkout to 110001 was refused with 409 for a guest and a signed-in customer, and with no address or no pincode with 400. No order or user was written.

`portal_audit_logs` was created on the local database during A1 (23 Oct 2026); production still needs `server/sql/portal_audit_logs.sql`.

## S3 — place the order from the server cart

**Decisions:** products without a price stay visible as "Price unavailable" with Add to cart blocked. A guest whose phone number already belongs to an account places a guest order; the account is never read or written.

**Why:** the phone still posts its own item list to `POST /orders`, so the order can differ from the Cart screen (the one product with two active prices is charged from an arbitrary row). Only products 3 and 5 can be ordered end to end today; 110,100 of 110,106 active products have no active price but the product page shows ₹450; four priced products (4, 6, 7, 8) have no variant.

### Server: `POST /cart/checkout`

Request (optional sign-in; guests send `x-session-id`):

```json
{
  "cartId": 412,
  "expectedTotal": 1880.82,
  "guestName": "Deepak", "guestPhone": "9876543210",
  "shippingAddress": "B-12, Sector 62, Noida - 201309", "pincode": "201309",
  "paymentMethod": "COD", "notes": "optional"
}
```

- `cartId` is the cart the phone shows. The caller must own it (signed-in user, or matching `x-session-id`), else 403. Without `cartId` the server uses the caller's active cart, but then a retry has no duplicate protection.
- `expectedTotal` (required, rupees) is the grand total the customer saw. Only `COD` is accepted; anything else is 400 "Only cash on delivery is available."
- Pincode rules are S2's.

One transaction, in this order:

1. Lock the cart row (`FOR UPDATE`).
   - If it is `ordered`, return the order placed from it (`orders.CartID`) with 200. This makes a double tap or a retry after a lost reply safe.
   - If it is `merged`, refuse with 409 "This cart was moved to your account. Open the cart again."
2. Read the lines and lock their first-variant rows.
3. Price every line with the same function the Cart screen uses: lowest active `SellingPrice`, bulk tier, first-variant stock, order limits.
4. Refuse if anything is wrong. Nothing is written in any of these cases:
   - No lines: 400 "Your cart is empty."
   - Any line with a problem: 409 with that line's sentence.
   - Grand total differs from `expectedTotal` by any paisa: 409 "Prices changed since you opened checkout. Check the new total and place the order again."
5. Write the order. Insert `orders` (with `CartID`), `order_items` and `order_status_history`, decrement `product_variants` and `inventory_stock`, and mark the product out of stock when every variant reaches 0. If the serving store has its own row in `store_variant_stock`, that row is decremented too, and it is what the stock check used. No row means the company figure.
   - Status is `confirmed`, payment `pending`, method `COD` (as today).
   - Delivery charge and tax use `cartTotals`.
6. Delete the cart's lines, set `carts.Status = 'ordered'`, and commit.

Response 201: `{ id, orderNumber, placedAt, status, paymentStatus, paymentMethod, customerName, deliveryAddress, lines, totals }`, where `totals` has the same shape as the cart's. A replay (step 1) returns the same body with 200.

**Shared pricing:** a single line-pricing function used by both `CartService.pricedCart` and checkout, so the order can never differ from the Cart screen. The legacy `OrderService.checkout` (item list on `POST /orders`) uses it too.

**No pretend orders:** order creation never uses the file store, on `/cart/checkout` or on `POST /orders`, even with `ALLOW_FILE_STORE=1`. Any database error rolls back and returns 503 "We couldn't place your order. Your cart is unchanged."

**Guests**

| Guest's phone | Order owner | Account touched? |
| --- | --- | --- |
| Not registered | New unverified customer record (as today) | Created only |
| Already belongs to an account | None: `UserID` empty, name and phone on the order | No; its name, contact and saved addresses are never read or written |
| Missing or not 10 digits | None | No |

**Schema** (`server/sql/shop_s3_checkout.sql`; applied to the local database 23 Oct 2026, still to run on production):

- `orders.CartID INT NULL` with a unique index.
- `carts.Status` gains `'ordered'`.

### Phone

- **Checkout summary:**
  - Shows the server's subtotal, bulk savings, delivery, GST and total: the same block as the Cart screen.
  - Lines are listed with their server unit price.
  - The button reads "Place order · ₹total".
  - It is disabled while a cart change is saving, a line has a problem, or the pincode is not served.
- **`placeOrder`:** calls `POST /cart/checkout` with the cart's id and the total on screen. No item list or prices are sent. `cartStore` keeps the server cart's id for this.
- **On success:** the server has already emptied the cart; the phone reloads it (`refreshCart`), so it stops calling `DELETE /cart` after an order. The confirmation screen shows the server's total.
- **On a 409:** shows the server's sentence and reloads the cart, so the new total or the problem line is visible.
- **On a network error or timeout:** "We couldn't confirm your order. Tap Place order again; it won't create a second order." The retry sends the same cart id.
- **Without an API base URL:** the labelled development test checkout is unchanged.

### Product page honesty (`catalogService`)

- **Price:** no ₹450 fallback. A product without an active price is sent without `price`, so the phone shows "Price unavailable", blocks Add to cart, and sorts it after priced items (existing phone behaviour).
- **Stock:** a product card reports the first variant's `product_variants.StockQuantity`. The product page lists every option. A cart call with no `variantId` sells the first; a call that names one sells that option. This replaces the sum of `inventory_stock` with a 150 fallback. A store with a row in `store_variant_stock` sells that quantity at checkout; no row means this company figure.
  - A product with no variant reports 0 and out of stock.
  - Expected change: the 48" Ceiling Fan shows 68 instead of 150.
- **Cart message:** for a product with no variant (`setLineQuantity`), it changes from "no longer in the catalogue" to "\"<name>\" isn't available to order right now."

### Tests and proof

- **Unit tests:**
  - the shared line pricing;
  - the expected-total comparison (to the paisa);
  - the guest owner rule: not registered, already registered, missing phone.
- **Local database proof** (script, explicit cleanup, no rollback tricks):
  - Record the order count and stock of variant 6 first.
  - A test guest cart with product 5 places an order.
  - The same `cartId` again returns the same order.
  - A wrong `expectedTotal` is refused.
  - A guest using a registered phone gets `UserID` empty and an unchanged account row.
  - Afterwards: delete the created order, items, history, carts and any new user by ID; put the stock back; check that counts and stock match the start.
- **HTTP on a spare port:**
  - product 3 shows 68 in stock;
  - an unpriced product has no `price`;
  - checkout without owning the cart is 403.
- **Checks:** typecheck and lint on server, portal and app; device run by the user.

**Not in S3:** payment, cancelling orders, invoices, notifications, choosing between variants, order status flow changes, fixing the four priced products without a variant (merchandisers add a variant or stock in the portal).

### S3 as built (23 Oct 2026)

**Duplicate protection:** it uses the cart, not a random checkout key, so the phone needs no new dependency. `orders.CartID` is unique, and checking out a cart that is already `ordered` returns its order.

**Server**

- `services/cartCheckoutService.ts` (`CartCheckoutService.place`) and the `POST /cart/checkout` route.
- **Shared pricing:** `CartService.cartRows` and `CartService.priceRows`, built on `priceLine` and `sameMoney` in `utils/cartRules.ts`, serve both the Cart screen and checkout. A product taken off the catalogue now counts as having no price in the cart too.
- **Shared order writing:** `OrderService.writeOrder`, `OrderService.receipt` (the same body for a first answer and a repeat) and `OrderService.ownerForGuest`. The ownership rule itself is `guestOrderOwner` in `utils/checkoutPricing.ts`.
- **`POST /orders` (older clients)** now uses the same pricing and guest rule, and refuses anything except COD. It also ignores three things from the request body:
  - `userId`: before, anyone could order as any customer;
  - `cartId`: before, the cart's owner was never checked;
  - client prices.

  A product with no variant is refused instead of being sold from an invented stock of 999.
- **No pretend orders:** order creation no longer uses the file store; a database failure is `orderFailed()` (503). `catalogueBasePrice` was removed.

**Catalogue (`catalogService`)**

- No ₹450 fallback; `price` is null without an active price.
- A product card's stock and stock status come from the first variant. The product page lists every option.
- The portal's single stock box (`writeCatalogueStock`) writes the first variant, for a product with one option. A product with several options has a stock box for each (`writeChosenStocks`). Existing inventory rows for that variant are resized to the same total. A variant with no inventory row keeps its stock on `product_variants` only. Before, one number was spread across all variants, which could leave the variant the shop sells at 0.
- A product update refuses a price of ₹0 or less, so saving an unpriced product in the portal can't store a ₹0 price.

**Portal:** shows "No price" in Catalogue and in the bulk calculator instead of ₹0.00 or ₹450. Order lines show the stored unit price and line total instead of a ₹450 fallback. `Product.price` is `number | null`.

**Phone**

- **Services:**
  - `cartApi.ts`: keeps the cart `id`; `cartHeaders` is exported; the `emptyServerCart` call (`DELETE /cart`) was removed.
  - `orderApi.placeOrder`: calls `POST /cart/checkout`.
  - `cartStore`: adds `cartId` and `getCheckoutCart()`; `clearCart` now just reloads.
- **Checkout screen:**
  - shows the server totals;
  - the button reads "Place order · ₹total", or "Updating prices…" / "Fix items in your cart";
  - a refusal shows the server's sentence and reloads the cart;
  - a network error, timeout or 5xx says the order couldn't be confirmed and that tapping again is safe.

**Verified 23 Oct 2026** against the local database and over HTTP on a spare port.

- **Catalogue:**
  - product 3 showed 68 in stock (was 150);
  - product 4 showed 0 and out of stock;
  - an unpriced product had `price: null`.
- **Adding to the cart:** product 4 was refused with "isn't available to order right now"; an unpriced product with "not available to order".
- **Refused at checkout:** UPI (400), a total ₹1 off (409), pincode 110001 (409), and another guest's cart (403). No order was written by any of them.
- **The order:** 2 × product 5 for ₹450.64 (₹298 + ₹99 delivery + ₹53.64 GST) was placed with 201.
  - Repeating the request gave 200 with an identical body.
  - The order row has `UserID` empty, because the phone belongs to an existing account; that account row was unchanged.
  - The cart became `ordered` with no lines, and stock went 500 → 498.
  - The same guest's next `GET /cart` gave a new empty cart.
- **`POST /orders`:**
  - an unpriced product was refused;
  - product 3 sent with `unitPrice: 1`, someone else's `userId` and a `cartId` was charged ₹2,457.82 (₹1,999 + ₹99 + ₹359.82). It was linked to a new unverified customer for the new phone, with `CartID` empty.
- **Cleanup:** all test orders, carts and the new user were deleted and stock and status were restored. Orders, carts and users match the starting counts.

**Production rollout:** run `server/sql/shop_s3_checkout.sql`, deploy the server, then ship the phone build. Older phone builds still work: `POST /orders` is unchanged for them, apart from the fixes above.

## Next

Shop functionality S0–S3 is built. Still to do:

1. **Device run** of S1–S3.
2. **Portal access** ([PORTAL_ACCESS.md](./PORTAL_ACCESS.md)): A1 roles and module permissions and A2 stores, groups and scope are both built.
3. **Portal UI/UX pass** ([PORTAL_UI_PASS.md](./PORTAL_UI_PASS.md)): design agreed 23 Oct; U1 first.
