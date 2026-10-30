# App team handover — live API, scope, and `app/` structure

For whoever builds or finishes the customer Expo app in `app/`. Pull `develop`, read this first, then use [`APP_API_GUIDE.md`](./APP_API_GUIDE.md) for exact request/response examples.

**Date:** 30 Oct 2026  
**Branch:** `develop`  
**Live API + staff portal:** `https://store.jiotechxpert.com`

---

## Ack — 30 Oct 2026 (list + search live)

API performance and search are **live on production**. Adopt these for phone browse/search; full shapes are in [`APP_API_GUIDE.md`](./APP_API_GUIDE.md) **UC-1** (`home-boot`) and **UC-3**.

| Use | Call |
|---|---|
| Home boot (preferred) | `GET /cms/home-boot` — sections, banners, deals, featured cards, categories in one payload |
| Product / category / search lists | `GET /catalog/products?view=card&total=false` (+ `search`, `categoryId`, `after`) |
| Typeahead while typing | `GET /catalog/search/suggest?q=` — wait until **2 characters**; groups: categories, brands, products |
| Curated “Try searching” chips | `GET /cms/search-suggestions` — unchanged; not live typeahead |

**App rules for UC-3**

- Prefer `view=card` on phones. Do not load the full portal-sized row for grids.
- With `view=card`, `search` shorter than 2 characters after trim is `400` — debounce in the UI.
- Page with `meta.nextAfter` + `after=` when `total=false` (skip heavy `COUNT`).
- Customer lists only include **priced** products. Unpriced SKUs are missing from list/search; open by id still works.
- Suggest may include `didYouMean` (close category/brand names) when nothing matches. Search results may set `meta.relaxed: true` after an any-word fallback.
- JSON responses are gzip-compressed on the live host; clients that send `Accept-Encoding: gzip` benefit automatically.

```bash
curl -s "https://store.jiotechxpert.com/cms/home-boot" | head -c 200; echo
curl -s "https://store.jiotechxpert.com/catalog/products?view=card&total=false&limit=5" | head -c 200; echo
curl -s "https://store.jiotechxpert.com/catalog/search/suggest?q=fan" | head -c 200; echo
```

---

## 1. What is live today

The store **API and merchandising portal** are deployed on the VPS behind that hostname. Product pictures are served from disk on the same host (`/store/assets/catalog/...`).

| Area | Status |
|---|---|
| Health / dual DB (`homecare` + `techxpertstore`) | Live |
| Catalog (categories, products, variants, images) | Live |
| Lean product list (`view=card`), ranked search, typeahead suggest | Live — see Ack above + UC-3 |
| Home CMS + `GET /cms/home-boot` | Live (content may be empty until staff fill the portal) |
| Cart (server-priced, pack size / `quantityStep`, variants) | Live |
| Delivery pincode check | Live |
| Customer OTP sign-in (`send-otp` / `verify-otp`) | Live when SMS is configured on the server; local/dev uses the documented test code |
| Checkout **cash on delivery (COD)** | Live — place order through `POST /cart/checkout` |
| Orders list / order again | Live |
| Wishlist / Talk to us / Help / About / Policies CMS | Live |
| **Online payment (PayU / UPI / cards)** | **Not built** — do not block COD checkout waiting for it |

**Verdict for the app:** you can build and ship the customer journey **through place order (COD)**. Treat PayU as a later slice on the same order record (`paymentMethod` stays `"COD"` until the gateway exists).

Quick checks:

```bash
curl -s https://store.jiotechxpert.com/health
curl -s "https://store.jiotechxpert.com/catalog/products?view=card&total=false&limit=1"
```

Staff portal (not the customer app): open `https://store.jiotechxpert.com` in a browser. Staff accounts are store `portal_staff` (or linked Homecare admins), not the old PHP store.

---

## 2. Point the Expo app at the API

Copy `app/.env.example` → `app/.env.local` (gitignored).

**Against production (device / Expo Go on the internet):**

```bash
EXPO_PUBLIC_API_BASE_URL=https://store.jiotechxpert.com/api
```

The API also answers without the `/api` prefix. Prefer `/api` so paths in [`APP_API_GUIDE.md`](./APP_API_GUIDE.md) match (guide writes `/catalog/...` after the base already includes `/api`).

**Against a laptop API** (see the guide §3–4):

```bash
# iOS simulator
EXPO_PUBLIC_API_BASE_URL=http://localhost:5001/api
# Android emulator
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:5001/api
```

After any change: `npx expo start -c`.

`app/src/services/apiConfig.ts` reads that env. Screens and feature code should call the thin clients under `app/src/services/` (`productApi`, `cartApi`, `orderApi`, `cmsApi`, `authService`, …), not hard-code hosts.

---

## 3. What is already in `app/` (structure — keep it)

This is an **Expo Router** app. Routes live only under `app/src/app/`. Do not invent a second navigation tree.

```text
app/
├── AGENTS.md                 # Expo / Router rules for agents and humans
├── .env.example
└── src/
    ├── app/                  # SCREENS ONLY (file = route)
    │   ├── _layout.tsx       # root layout
    │   ├── index.tsx
    │   ├── login.tsx
    │   ├── otp-login.tsx
    │   ├── checkout.tsx      # COD place-order UI
    │   ├── order-placed.tsx
    │   ├── (tabs)/           # Home, Orders, Categories, Help, Cart
    │   ├── products/         # list + [id]
    │   ├── category/[id].tsx
    │   ├── about/            # about + policies
    │   └── …
    ├── components/
    │   ├── ui/               # Button, TextField, Toast, sheets…
    │   ├── home/             # Hero, shortcuts, trust, deals rails…
    │   ├── store/            # ProductCard, cart, gallery…
    │   ├── auth/
    │   └── brand/
    ├── services/             # HTTP only — map API ↔ app types
    ├── state/                # session, cart, wishlist, location…
    ├── hooks/
    ├── types/
    ├── constants/            # theme, brand, languages
    ├── data/                 # fallbacks / legal copy until CMS is filled
    └── utils/
```

**How to add UI from the shared designs**

1. Keep the **route file** in `src/app/…` thin: load data, wire navigation, compose components.
2. Put visual pieces in `src/components/…` (`ui` for primitives, `home` / `store` / `auth` for product UI).
3. Put network calls in `src/services/…`. Reuse `apiClient.ts` (auth header, session id, errors).
4. Put client state in `src/state/…` (cart session id, wishlist, location). Server cart totals remain source of truth — see the API guide.
5. Match tokens in `src/constants/theme.ts` and `brand.ts` to the shared UI kit (colours, type). Do not introduce a parallel theme system.
6. Prefer extending existing screens (`home`, `checkout`, `products/[id]`, …) over new parallel routes with the same job.

The designs the app team already shared (Figma / exports — held outside this repo) are the visual source of truth for layout and look. This repo’s `app/` is the **implementation skeleton and API wiring** to fill those screens; replace demo/fallback content with live API data using the services above.

---

## 4. Customer flows that are API-ready (build these)

Full call shapes, refusals, and examples: [`APP_API_GUIDE.md`](./APP_API_GUIDE.md). Summary:

| # | Flow | Notes |
|---|---|---|
| 1 | Home | Prefer `GET /cms/home-boot`; else banners, sections, shortcuts, projects, deals, trust, search ideas |
| 2 | Categories / brands | Public catalog lists (cached ~30s) |
| 3 | Product list + search | **UC-3:** priced `view=card` + `total=false` / `after`; typeahead `GET /catalog/search/suggest?q=` (≥2 chars); respect `quantityStep` |
| 4 | Product detail | Variants, gallery, bulk tiers, highlights/specs |
| 5 | Pincode | Check before checkout; server refuses unserved areas |
| 6 | Cart | Server cart; `PUT` lines with `variantId`; show server totals |
| 7 | Sign-in | OTP for production; guest checkout still allowed |
| 8 | Checkout COD | `POST /cart/checkout`, `paymentMethod: "COD"`; expected total must match |
| 9 | Orders / order again | After place order |
| 10 | Wishlist, help, about, policies, talk-to-us | CMS + shop request endpoints |

**Out of scope until named later:** PayU (or any online payment), credit terms. List/search performance work above is already live — use it.

---

## 5. Rules that save rework

- **Backend prices and stock win.** Never trust a price typed only on the phone for checkout.
- **Images** are absolute HTTPS URLs when `PUBLIC_API_ORIGIN` is set (production). Some SKUs still 404 if the file was never uploaded under `catalog/catalog/` — show a placeholder; do not block the flow.
- **Guest vs signed-in:** cart uses Bearer token or `x-session-id` (see guide). Keep one session id stable on the device.
- **Do not commit** `.env`, `.env.local`, or production secrets.
- **Portal** (`web/`) is staff-only. Customers never use it.

---

## 6. Docs map

| Doc | Use for |
|---|---|
| **This file** | Live URL, scope (COD yes / PayU no), folder structure, how to apply UI designs |
| [`APP_API_GUIDE.md`](./APP_API_GUIDE.md) | Local API setup + every use case with real JSON |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Dual DB and system boundaries |
| [`STORE_PLAN.md`](./STORE_PLAN.md) | Product plan; PayU listed as later |
| [`app/AGENTS.md`](../app/AGENTS.md) | Expo Router / SDK conventions |

---

## 7. Suggested first week for the app team

1. Clone repo, `git checkout develop`, `cd app && npm install`.
2. Set `EXPO_PUBLIC_API_BASE_URL` to production (or local API).
3. Confirm `home-boot` + `view=card` list + `search/suggest?q=fan` + one product detail against live JSON.
4. Wire search UI: 2-char minimum, suggest while typing, results page via `view=card`.
5. Wire cart → pincode → checkout COD end-to-end on a device.
6. Align each screen to the shared UI designs without moving files out of the structure in §3.
7. Leave payment UI as “cash on delivery” only until PayU is scheduled.
