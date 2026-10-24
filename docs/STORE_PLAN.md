# Techxpert Store — product plan

As of **24 Oct 2026**. This is the plan to discuss and build from. What is already on the server is marked **built**. Nothing in Phase 1 onwards is started except **shop settings** (item 15), which the delivery fee, the free-delivery line and the GST rate now read.

Local `develop` is ahead of GitHub. `main` moves only when asked.

## Vision

Homeowners and contractors can both buy through the app, with clear prices and visible bulk rates, as long as stock covers the order. Large or special orders are confirmed by staff, who can also place orders on a customer's behalf, with accurate stock and proper tax invoices. Our own team runs the catalogue, prices, stock, rules and orders without a developer.

## Who it is for

| User | What they need |
|---|---|
| Homeowner | Browse, see a true price, check delivery, order, track |
| Contractor | See bulk rates, buy the full quantity when stock allows, repeat an order, get a GST invoice, reach staff for a special order |
| Merchandiser | Run the catalogue, prices, homepage, banners, stock and pages without an app release |
| Operations | Confirm large orders, place an order for a customer, manage delivery areas and stores |
| Owner | Decide who can do what, change the business rules, see who changed what |

## How an order can arrive

1. **Self-serve in the app.** A small order is confirmed straight away. An order above the staff-set threshold is placed as `pending` for staff to confirm. **Not built.** Today every shop order is written as `confirmed`.
2. **"Talk to us".** The customer sends a request (name, phone, cart, pincode) to a staff queue. **Not built.** Help today is contact details, and that page is empty.
3. **Staff-created.** Staff place the order on the customer's account. **Not built.**

All three must use the same server rules for stock, the pincode's store, GST and price. Each order carries a source tag: `app`, `request`, or `staff`. **The tag is not built.**

## Principles

- The server decides money and access. The phone and the portal only display and ask.
- A refusal is a sentence a person can act on. A failure never pretends to succeed.
- The `homecare` schema is never changed.
- Business rules (thresholds, limits, fees, the GST rate) are settings staff can change, not numbers buried in code.
- A staff change to money (price, delivery charge) is a deliberate action with its own permission, shown on the order and written to the audit trail.

## What is already built

Plan items 1–24. Detail is in [`PROJECT_STATUS.md`](./PROJECT_STATUS.md).

- Server prices, guest and signed-in cart, pincode check, cash on delivery, stock returned when a shop order is cancelled.
- Bulk tiers are stored in the portal and applied by the server from the quantity. The phone never sends a price. Product detail already returns `bulkTiers`. The cart already uses the tier. The app still has to draw "Buy 50+, pay ₹X".
- Checkout already refuses a line the stock cannot cover, including a store cap when staff have set one. The sentence is `Only 12 of "…" are in stock.`
- Pack size is enforced. Every product is still at 1 until staff set one. Setting packs for bags and cartons is catalogue work.
- Company stock is the selling number. A store with no row of its own sells that figure. The phone shows the company figure because it does not send a store.
- Homepage, help, About, policies and deals are empty until staff fill them.
- Staff roles, stores, scope and an audit trail.

183 unit tests pass, including shop settings. The old `inventory_stock` warehouse table is not the number the shop sells.

## Phase 0 — close what is already built

- Push the local `develop` commits when asked. Never push to `main` unless asked.
- Restart the API on port 5001 when asked, so the phone runs this code.
- Staging desk proof against a staging API.
- Production checklist, run by someone with production access.

## Phase 1 — launch blockers

**Sellable shop**

1. **Launch catalogue.** The first products a customer can actually buy (cement, pipes, paint, fans, tiles and so on). A product is launch-ready when it has an active price, a unit, stock, a description and an image. About 110,100 of 110,106 active products have no active price today.
2. **Product images.** Host the files and serve the gallery paths that already exist.
3. **Pack sizes** for bagged and boxed goods. The rule is built. The numbers are still 1.

**Sign-in and the app** (app team)

4. An SMS provider for the one-time code. Production refuses the old password login.
5. The same order words on the server and the app. The server uses `pending`, `confirmed`, `processing`, `shipped`, `delivered`, `cancelled`.
6. Keep the sign-in token across an app restart.
7. Send `variantId` and read `limits.step`.
8. A device run of cart, pincode and checkout.

**Bulk and large orders**

9. **Show the bulk tier.** The server already picks it. The product page and the cart must show it.
10. **Full-quantity check.** Already the checkout refusal. The app must show that sentence so the customer can order the available amount or contact staff.
11. **Large-order rule.** Above a staff-set value or a staff-set quantity, the order is `pending`. Cash on delivery is not treated as already confirmed. Staff confirm it. The thresholds are stored as settings. Checkout does not use them yet: the stock question below has to be answered first.
12. **"Talk to us"** and a staff queue for orders that do not fit the shelf.
13. **Staff-created orders**, with the source tag and an audit line.

**Tax**

14. **GST invoice with GSTIN**, captured on the account and printed on the invoice. Confirm the format with the accountant before building it.

**Rules as settings**

15. **Shop settings**, with its own permission, audited. **Built.** Delivery fee, free delivery and GST are read from here. The large-order thresholds and the cash-on-delivery limit are saved here and not yet applied at checkout. A rule that is switched off does not apply. Defaults match what the code used before: delivery ₹99, free from ₹2,000, GST 18%. The three thresholds start off.

## Phase 2 — soon after launch

- Staff may change the delivery charge, or agree a price, only on a pending or staff-created order, with its own permission and an audit line.
- Alerts when a new order or a new request arrives.
- Order confirmation by SMS or WhatsApp.
- A reason on every stock edit: received, counted, or damaged, written to the audit trail.
- A delivery promise ("arrives in X days") and a short "Report a problem" that creates a staff task.
- The app reads the remaining server lists: home, search ideas, trust strip, About, policies, deals, help.

## Phase 3 — later, only when named, in this order

1. Online payment and credit terms.
2. Returns and refunds. Cancelling a shop order already puts stock back.
3. Full inventory movements and a low-stock mark.
4. Customer push notifications.
5. Weight-based delivery pricing.

## Out of scope

A customer website, ERP, warehouse management (warehouses, transfers, purchase orders, reservations, RFID), Homecare code, and using `inventory_stock` as the selling number. Ratings stay off the server. Do not invent review scores or a discount on a deals tile.

## Settings staff can change

| Setting | Starting value | Checkout uses it |
|---|---|---|
| Large-order value | Off | Not yet |
| Large-order quantity on one line | Off | Not yet |
| Cash-on-delivery limit | Off | Not yet |
| Free delivery from | ₹2,000 | Yes |
| Delivery fee | ₹99 | Yes |
| GST | 18% | Yes |

Company-wide first. Per-store fees can wait. Switching a threshold off means that limit does not apply. Switching the delivery fee off means there is no fee. Switching the free-delivery line off means the fee is charged on every order that has one. Switching GST off means the order has no GST.

## Still to decide

1. **Starting threshold numbers.** They are editable, so the first numbers are only a start.
2. **Pending orders and stock.** Today stock is taken when the order is written. If a large order is `pending` and also takes stock, an abandoned order locks the shelf until someone cancels it. If stock is taken only when staff confirm, two pending orders can both be promised the same goods. This is unanswered, so checkout still confirms every order and takes stock immediately.
3. **Cash on a large order.** Placing it as `pending` already stops it being treated as confirmed. A separate cash limit can still refuse cash above an amount.
4. **Accountant sign-off** on the invoice and GSTIN.
5. **Who prices and stocks the launch catalogue.**

## How to judge it

- Share of launch products that can be bought (price, stock, image).
- Orders where the price and stock the customer saw were the price and stock sold.
- Orders by source, once the tag exists.
- Share of large orders that staff confirmed.
- Staff changes to money, stock or access that name the person. The target is all of them.
