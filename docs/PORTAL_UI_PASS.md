# Portal UI/UX pass

Agreed with the user on 23 Oct 2026. One phase at a time; each phase is checked (web typecheck, lint, browser) before the next starts. Work is on `develop`.

## Goal

Make the merchandising portal (`web/`) a clear, trustworthy daily tool for staff:

- plain staff wording;
- no invented values and no developer text;
- the same tables, states and buttons on every screen.

The look stays the same: colours, fonts and dark theme.

**Out of scope:** new features (order filters by store or date, bulk actions), tablet or phone layout, a visual redesign, and the phone app.

## Decisions

| Question | Answer |
|---|---|
| Main aim | Trustworthy daily tool, same look |
| API & Mobile Sync tab | Kept, only for super admin, renamed **Developer tools**. Removed from the role editor's module list. |
| Order of work | U1 truth and wording, then U2 shared building blocks, then U3–U6 screens in batches |

## U1 — Truth and wording

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

## U2 — Shared building blocks

New pieces in `web/src/components/ui/`, alongside `Button`, `Modal`, `DataTable`, `EmptyState`, `Badge`, `StatCard` and `SearchInput`:

| Piece | Purpose | Replaces |
|---|---|---|
| `Panel` | Surface card, optional title and right-side actions | Six copied `panel` style objects |
| `PageIntro` | One sentence on what the screen is for, plus the screen's actions (Refresh, New…) | Per-screen `toolbar` + `hint` styles |
| `Field` | Label, then input/select/textarea, then error text; one input style | Per-screen `label` / `input` / `error` styles; `alert` for validation |
| `LoadState` | Loading, "Couldn't load X" + Retry, and empty with a next step | Ad-hoc loading and error text; silent blank screens |
| `ConfirmDialog` | In-app confirm on `Modal`; says exactly what happens; red button when destructive | 8 `window.confirm` and 5 `alert` calls |

**Rules for every screen:**

- Table headers in sentence case ("Order", "Customer", "Total").
- Buttons: one orange primary per screen or modal; secondary for Edit; ghost for Refresh; red for destructive.
- Missing data: "Not given", muted.
- Money: ₹ with Indian grouping. Dates: "23 Oct, 12:40".

**Proof screens:** Delivery Pincodes and Roles & Access move onto the new pieces in U2.

**Check:**

- Web tsc and oxlint.
- Browser check of the proof screens' loading state.
- Their error state with the API stopped.
- Their empty state, and confirm dialogs.

## U3–U6 — Screens in batches

Each batch moves its screens onto U2's pieces and rules, then gets a browser check.

| Batch | Screens | Also fix |
|---|---|---|
| U3 Daily operations | Orders, Customers, Dashboard | Order detail layout. Remove the database explainer panel on Customers. Dashboard figures in staff terms. |
| U4 Catalogue | Products, Categories, Bulk Pricing | Category `alert` errors become field errors. Calculator uses `Field` / `LoadState`. |
| U5 Storefront | Campaign Banners, Homepage Sections | Banner editor `alert` / `confirm` replaced. Sections error state from U1 on `LoadState`. |
| U6 Admin and shell | Stores & Groups, Audit Trail, Sign-in, Developer tools, sidebar, header | Audit entries read as staff sentences. |

## Done when

- Every screen uses `PageIntro`, `LoadState` and `ConfirmDialog` (where it deletes or deactivates), and follows the rules above.
- No staff-facing developer wording remains.
- No invented values are shown.
- `PROJECT_STATUS.md` plan item 6 is marked done.
