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
- The sign-in screen says "Sign in with your staff account."
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

## Done when

- Every screen uses `PageIntro`, `LoadState` and `ConfirmDialog` (where it deletes or deactivates), and follows the rules above.
- No staff-facing developer wording remains.
- No invented values are shown.
- `PROJECT_STATUS.md` plan item 6 is marked done.
