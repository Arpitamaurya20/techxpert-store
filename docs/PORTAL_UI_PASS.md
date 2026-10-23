# Portal UI/UX pass

Agreed with the user on 23 Oct 2026. One phase at a time; each phase is checked (web typecheck, lint, browser) before the next starts. Work is on `develop`.

## Goal

Make the merchandising portal (`web/`) a clear, trustworthy daily tool for staff:

- plain staff wording;
- no invented values and no developer text;
- the same tables, states and buttons on every screen.

Fonts and layout stay the same. The colours changed during U1 at the user's request: the dark theme was replaced by a light workspace in the logo colours (see Decisions).

**Out of scope:** new features (order filters by store or date, bulk actions), tablet or phone layout, layout redesigns, and the phone app.

## Decisions

| Question | Answer |
|---|---|
| Main aim | Trustworthy daily tool, same look |
| API & Mobile Sync tab | Kept, only for super admin, renamed **Developer tools**. Removed from the role editor's module list. |
| Order of work | U1 truth and wording, then U2 shared building blocks, then U3–U6 screens in batches |
| Theme (added 23 Oct) | Light workspace in the logo colours: off-white page, white cards, ink text, Techxpert blue (`--accent`) as the one accent, red only for problems. Colours are tokens in `web/src/index.css`; screens use `var(--…)`, not hex. |
| Toasts (added 23 Oct) | One `ToastProvider` (`ui/Toast.tsx`, `useToast()`): success, error and info tones, stacked, errors stay 8 s. Every save, delete, status change and failed load reports through it; form errors stay next to the field. |
| Logo (added 23 Oct) | The logo image is the full wordmark, so the sidebar and sign-in show it once with "Store portal" under it, never a second "TECHXPERT" text. |

## U1 — Truth and wording — done 23 Oct 2026

As built, beyond the list below:

- The server no longer invents customer names or SKUs in order lists and detail; old orders that stored a placeholder such as "Valued Customer" read as "Not given". New orders store an empty name instead of a placeholder. Product-name fallbacks stay because the phone app drops unnamed lines.
- Order detail shows the stored subtotal, bulk savings (already inside the subtotal), delivery, tax and total; the old ×0.82 / ×0.18 split is gone.
- The calculator shows an error instead of a locally guessed price when the server can't answer.
- Customers lost the invented "Identity Sync Rate 100%" card; Bulk Pricing lost "Calculation Engine: Real-time".
- A failed load keeps the last data that loaded (counts no longer drop to 0) and names what failed in a toast. The server status re-checks every 30 s and says when it is back.
- The sign-in hint with the local seed password shows only in development builds.

No layout changes.

**Show what's real.**

- Orders: missing name, phone or address shows **"Not given"** in muted text. This replaces "Valued Customer", "Customer", "Standard Delivery Zone", "Standard Address" and "+91 N/A". A missing SKU shows no SKU line.
- Homepage Sections:
  - If loading fails, show "Couldn't load homepage sections" with **Retry**. The built-in sample list (`INITIAL_SECTIONS`) is never shown as live data.
  - Reset reports success only when the server confirms it.
- Bulk pricing calculator: call the API through `fetchApi` (the configured base URL), not `http://localhost:5001`. This fixes a production bug.

**Server status.**

- The header shows **"Connected"** or **"Can't reach the server"**, with no port.
- The sidebar footer loses the server URL and "Expo App Target".

**Developer tools.**

- The `api` module is removed from the module list on server and web.
- The tab is shown only when the signed-in person is super admin.
- Stored `api` grants are ignored. Confirm the server ignores unknown module rows when loading and saving roles; fix it if not.

**Plain wording.**

- Remove database and table names, endpoint paths, and "MySQL", "SRS", "homecare", "techxpertstore" and "Expo"/"React Native" from all staff-facing text. That covers titles, subtitles, labels, search hints, empty states, toasts and audit messages.
- Examples:
  - "Customers (homecare)" becomes "Customers".
  - "Search MySQL catalogue…" becomes "Search products by name, SKU or brand…".
  - "Reset to SRS Defaults" becomes "Reset to default layout".
- The sign-in screen says "Sign in with your staff account." Since access A3 it says to use a store portal login, or your Homecare email and password if you've been linked.
- Developer detail stays only on Developer tools.

**Check.**

- Web tsc and oxlint.
- `rg` for the words above finds nothing outside `ApiExplorer.tsx` and code comments.
- Browser check:
  - an order with missing details shows "Not given";
  - Sections shows the error with the API stopped;
  - the calculator works against a spare-port API;
  - a Merchandiser has no Developer tools tab, and super admin does.

## U2 — Shared building blocks — done 23 Oct 2026

New pieces in `web/src/components/ui/`, alongside `Button`, `Modal`, `DataTable`, `EmptyState`, `Badge`, `StatCard` and `SearchInput`:

| Piece | Purpose | Replaces |
|---|---|---|
| `Panel` | Surface card, optional title and right-side actions | Six copied `panel` style objects |
| `PageIntro` | One sentence on what the screen is for, plus the screen's actions (Refresh, New…) | Per-screen `toolbar` + `hint` styles |
| `Field` | Label, then input/select/textarea, then error text; one input style | Per-screen `label` / `input` / `error` styles; `alert` for validation |
| `LoadState` | Loading, "Couldn't load X" + Retry, and empty with a next step | Ad-hoc loading and error text; silent blank screens |
| `ConfirmDialog` | In-app confirm on `Modal`; says exactly what happens; red button when destructive | 8 `window.confirm` calls (the `alert` calls became toasts in U1); 7 left after U2, in Categories, Banners, Stores & Groups and Catalog |

**Rules for every screen:**

- Table headers in sentence case ("Order", "Customer", "Total").
- Buttons: one blue primary per screen or modal; secondary for Edit; ghost for Refresh; red for destructive.
- Missing data: "Not given", muted.
- Money: ₹ with Indian grouping. Dates: "23 Oct, 12:40".

**Proof screens:** Delivery Pincodes and Roles & Access move onto the new pieces in U2.

**Check:**

- Web tsc and oxlint.
- Browser check of the proof screens' loading state.
- Their error state with the API stopped.
- Their empty state, and confirm dialogs.

**As built:**

- **`Panel`, `PageIntro`:** as in the table.
- **`Field` and `FormError`:**
  - `Field` gives its child the shared `tx-input` class (`index.css`). That class has a visible focus ring, a red border when invalid, and a disabled look.
  - It wires `id`, `aria-invalid` and `aria-describedby` to the hint or error.
  - `FormError` is for problems that belong to no single field, such as the server refusing a save.
- **`LoadState`:**
  - Shows loading only when there is nothing to show yet.
  - A failed reload keeps the rows on screen under a "Couldn't load X … Showing what was loaded before." banner with Retry.
  - With nothing loaded, the error replaces the content.
  - When empty, it shows `EmptyState` with a next step.
- **`ConfirmDialog` and `useConfirm()`:**
  - `useConfirm()` is an awaitable swap for `window.confirm`: `if (!(await confirm({ title, message, confirmLabel, destructive }))) return;`.
  - Destructive confirms are solid red (new `destructive` Button variant) and put focus on Cancel. Otherwise the confirm button gets focus.
- **`Modal`:**
  - Now labelled by its title.
  - Moves focus inside on open: to `[data-autofocus]`, or to the dialog itself.
  - Gives focus back to whatever opened it on close.
- **`NotGiven` and `services/format.ts`:**
  - `NotGiven` takes its label as a prop ("Not recorded" for money).
  - `services/format.ts` provides `inr`, `isMoney`, `formatWhen` ("23 Oct, 12:40"; the year only when it isn't this year) and `formatDay`.
  - `OrdersManager` uses them.
- **The `spin` class:** every button's loading icon used it, but it was never defined, so it now exists.
- **Delivery Pincodes:**
  - Per-field errors, including "Choose the store that delivers here" when your role can't leave a pincode unserved.
  - Pause asks first and says that placed orders are unaffected and nothing is deleted. Resume doesn't ask.
  - Refresh keeps the list on screen.
  - The stat cards show "—" until the first load succeeds.
- **Roles & Access:**
  - Delete role is a labelled red-tinted button with a destructive confirm.
  - Moving someone to "No portal access" asks first.
  - The role name error sits under the name field.
  - A failed reload no longer replaces the whole tab.
- **Truth fixes found while checking:**
  - A network failure now reads "Can't reach the server." everywhere, instead of "Failed to fetch".
  - Reloading while the server is down no longer signs you out. Only a 401 does.
  - The sidebar counts stay hidden until they have loaded once, instead of showing 0.

## U3–U6 — Screens in batches

Each batch moves its screens onto U2's pieces and rules, then gets a browser check.

| Batch | Screens | Also fix |
|---|---|---|
| U3 Daily operations | Orders, Customers, Dashboard | Order detail layout. Remove the database explainer panel on Customers. Dashboard figures in staff terms. |
| U4 Catalogue | Products, Categories, Bulk Pricing | Category save errors (toasts since U1) move next to the fields. Calculator uses `Field` / `LoadState`. |
| U5 Storefront | Campaign Banners, Homepage Sections | Banner editor `alert` / `confirm` replaced. Sections error state from U1 on `LoadState`. |
| U6 Admin and shell | Stores & Groups, Audit Trail, Sign-in, Developer tools, sidebar, header | Audit entries read as staff sentences. |

### U3 — Daily operations — done 23 Oct 2026

- **Loading, per piece:** `App.tsx` now records, for each piece it loads (products, orders, customers, banners, bulk pricing, sections), whether it has loaded once and why it last failed. Orders and Customers use that with `LoadState`. Their counts and the Dashboard's read "—" (shortcuts: "Not loaded yet") until the data has loaded, never 0.
- **Customers** uses the list `App.tsx` already loads instead of fetching its own copy, so its count matches the sidebar and Dashboard. The explainer panel is gone; `PageIntro` says the list is read-only. Headers are sentence case; "Inactive" became "Switched off".
- **Order statuses** have one helper, `services/orderStatus.ts`, with labels, which statuses count as open (anything not delivered or cancelled), badge colours and payment wording ("Cash on delivery", "Not paid yet"). Orders and the Dashboard both use it, so "still to deliver" is one number. A status the list doesn't know, such as an old "packed", still shows instead of silently reading as Pending.
- **Orders:**
  - The fourth figure is order value without cancelled orders (it used to add cancelled orders as "revenue processed").
  - The status filter shows a count for each status.
  - Missing payment method shows nothing instead of an invented "COD".
  - Cancelling asks first and says stock isn't put back and nothing is refunded from the portal.
  - The audit entry and toast name the order number ("Order TX-ORD-… marked as processing").
- **Order detail** reads top to bottom: status (changeable there), payment and store; customer and delivery address side by side; items; totals. The time uses `formatWhen`.
- **Dashboard:**
  - "Orders still to deliver" uses the shared open rule (it used to use a different status list from Orders).
  - "Banners live in the app" uses the server's rule (`services/bannerLive.ts`, same as `bannerEligibility.ts`), so a scheduled banner inside its dates counts and an expired one doesn't.
  - The greeting uses the staff member's name.
- **Server truth fixes:** the customer list's order value leaves out cancelled orders. If order figures can't be read, the list returns them as unknown (shown "Not available") instead of 0 orders and ₹0.
- **`Modal`:** with a confirm open over another dialog, Escape closes only the top one.
- **Checked:**
  - Web tsc and oxlint (only the existing set-state-in-effect warnings); 84 server tests.
  - In the browser:
    - Orders list and detail, including an order with no name.
    - The cancel confirm: Escape and "Keep order" leave the order unchanged.
    - A real status change, which survived a reload, then set back.
    - Customers.
    - Dashboard.
    - With the API stopped: "Couldn't load orders/customers" with Retry, and "—" everywhere. Retry recovers once the API is back.

### U4 — Catalogue — done 23 Oct 2026

- **Forms say what's wrong where it's wrong.** Products, categories, subcategories and bulk prices check their fields before sending and show each problem under the field. A refusal from the server stays in the open form ("Not saved: …") instead of a toast that disappears. The `App.tsx` save handlers no longer show their own error toast; they reject so the form can.
- **Products:**
  - The figures read "—" until loaded. While searching, the first figure is "Products matching".
  - A product with no price reads "No price, can't be sold" instead of ₹0.
  - Stock is a badge: Out of stock / N left / N in stock.
  - Add product starts on "Choose a category" instead of quietly picking the first one.
  - Editing can't remove a price (the server can't either), and the form says so. A blank brand keeps the old one, and the hint says so.
  - Saving a product with no price no longer turns it into ₹0.
  - Remove asks first and says what happens: gone from the app at once, orders untouched, can't be brought back from the portal.
- **Categories:**
  - Each panel has its own `LoadState`, and a failed reload keeps the last list.
  - Rows are one select button plus labelled edit and remove buttons, no longer a button inside a button.
  - A taken short code shows under the Short code field.
  - A newly added category is selected and scrolled into view.
  - "Add subcategory" is secondary, so the screen has one blue button.
  - Remove asks first, for both categories and subcategories.
- **Bulk Pricing:**
  - The table shows the product the bulk price really applies to, from the catalogue. The name copied onto the bulk price row could be wrong: three rows said "Heavy Duty Copper Cable" but apply to a removed product, and two said "Commercial Ceiling Downlight" but apply to the 9W LED Bulb.
  - Rows for a removed product say they never apply.
  - "Products with a bulk price" counts live products only.
  - The note can be cleared.
  - The form checks quantities (up-to at least from), percent (1–90) and fixed price (less than the normal price).
- **Price check:**
  - It lists products with a bulk price first.
  - It asks the server, with `Field` and `LoadState`.
  - It shows normal price, bulk price applied, unit price and total.
  - It no longer looks chosen while nothing is selected.
  - It runs once per change.
- **Server fixes found by the browser check:**
  - Adding a category always failed: `CreatedDate` has no default, so it is now set on insert.
  - Adding a subcategory always failed: `sub_categories.ID` has no `AUTO_INCREMENT` in the live DB, so the ID is now `MAX(ID)+1` under a named lock, as for stores.
  - A taken code now gives 409 "That short code is already used…" instead of "Database unavailable…".
  - Bulk prices come back with the catalogue's product name, SKU, live flag and price. New ones check the product exists and copy its real name instead of "Construction Product".
  - `DATABASE_SCHEMA.md` now matches the real category tables.
- **Checked:**
  - Web tsc and oxlint (only the existing warnings); server tsc; 84 server tests.
  - In the browser:
    - Products: list, Add and Edit validation, Remove confirm then Cancel.
    - Categories: a real add of a category and a subcategory, a taken code, removing both through the confirms. The two test rows were then deleted by ID.
    - Bulk Pricing: price check, form validation, Remove confirm then Cancel.
    - With the API stopped: "Couldn't load …" with Retry and "—", and the forms show "Not saved: Can't reach the server." Retry recovers once the API is back.

### U5 — Storefront — done 23 Oct 2026

- **Campaign Banners** (rewritten on U2's pieces; no `alert` / `window.confirm` left):
  - The figures are Banners, "Live in the app now" and "Not in the app" (for example "1 paused"). Live uses the server's rule (`bannerLive.ts`). When nothing is live, the figure says the app shows its own built-in slides, which it does (`getHeroSlides` in the app).
  - Each card says where the banner stands: "Live in the app", "Starts 25 Oct, 10:00", "Ended …", "Paused, not in the app", or "Scheduled with no start, never shows".
  - Each card says what the button opens, worked out by the app's own rules (`mapCtaHref`): a named category, a product, or all products.
  - Old "external" buttons are flagged, because the app doesn't open outside links and shows all products instead. The editor no longer offers them, and "Deals rail" became "All products" (`/products`), because the app has no `/deals` page.
  - The editor:
    - Field errors sit under each field. The category is picked from the list instead of typed as an id.
    - The status hint says what each status means in the app.
    - The end must come after the start, and an end that has passed is pointed out.
    - Server refusals show as "Not saved: …".
  - "Serviceable delivery location scope" and the invented default terms text are gone: the app shows every live banner to everyone and never reads either field.
  - Delete asks first and suggests Pause for a break. Reordering works only on the full list, renumbers 1…n (two banners sharing a number used to make the arrows do nothing) and no longer changes React state in place.
  - The audit and toasts name the banner instead of its id.
- **Homepage Sections:**
  - It moved onto `PageIntro` and `LoadState` (its own error box is gone) and loads with the other pieces.
  - Blocks are a numbered list with a Shown / Hidden badge and Hide / Show buttons. The "type: hero_carousel" tag is gone, and the arrows have labels.
  - "Reset layout" asks first and says names and descriptions go back too.
- **Server:**
  - Updating a banner can clear its subtitle, and returns the saved row instead of echoing the request.
  - A banner without a title or image is a 400 with a plain message.
- **Checked:**
  - Web tsc and oxlint (9 warnings, one fewer than before: the banner preview no longer resets in an effect); server tsc; 84 server tests.
  - In the browser:
    - Banners: an empty Add, end before start, then a real draft. Then a subtitle added and cleared (checked in the DB), Publish (live, and in the public list), Pause, moving up and back down, and Delete through the confirm. The order was the same as before after a reload.
    - Sections: Hide and Show, moving up and back down, and the Reset confirm cancelled.
    - With the API stopped: both screens show "Couldn't load …" with Retry, and "—". Retry recovers once the API is back.

## Done when

- Every screen uses `PageIntro`, `LoadState` and `ConfirmDialog` (where it deletes or deactivates), and follows the rules above.
- No staff-facing developer wording remains.
- No invented values are shown.
- `PROJECT_STATUS.md` plan item 6 is marked done.
