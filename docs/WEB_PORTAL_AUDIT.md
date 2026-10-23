# Techxpert Store — Web Merchandising Portal Audit

**Scope:** `web/` admin portal + related `server/` APIs (P1–P5 + post-audit polish + Medium tranche)  
**Date:** 22 Oct 2026  
**Method:** Static code review of current workspace (not a penetration test; no live traffic replay)  
**Build status at audit:** re-verify with `cd server && npx tsc --noEmit` and `cd web && npm run build`

---

## 1. Executive summary

| Dimension | Rating | Notes |
|---|---|---|
| **Feature completeness (P1–P5)** | **Good** | Catalog CRUD, banners, sections, audit, categories, staff login all present and wired |
| **AuthZ for portal writes** | **Good** | `requireAdmin` + `requirePermission(module, level)` from store roles ([PORTAL_ACCESS.md](./PORTAL_ACCESS.md)) |
| **Production readiness** | **Fair–Good** | JWT/CORS/seed hardened; HttpOnly cookie session + CSP; multi-node rate-limit still in-memory |
| **Data integrity (MySQL ↔ portal)** | **Good** | Product create transactional + `GET_LOCK`; packaging maps to `MeasurementUnitID` |
| **Mobile contract alignment** | **Good** | App home consumes `GET /cms/banners` + `GET /cms/sections` (fallback to static) |

**Overall (after Medium tranche):** High + Medium findings from the initial audit are **addressed in code**. Residual risk is mainly Low items and multi-node rate-limit. Re-test before internet-facing deploy.

---

## 2. Inventory (what was audited)

### Portal modules (`web/src`)
| Module | Files | Purpose |
|---|---|---|
| Auth gate | `App.tsx`, `LoginScreen.tsx`, `services/session.ts` | Cookie session + profile cache, login UI, logout |
| API client | `services/api.ts` | `credentials: 'include'` + optional Bearer, 401 → clear session |
| Catalog / CMS / Orders / Audit | components under `web/src/components/` | Merchandising ops |

### Server (`server/src`)
Auth middleware (Bearer **or** HttpOnly `tx_admin_token`), catalog, CMS, pricing, cart ownership, audit.

---

## 3–4. Findings status

### High — **Fixed** (prior polish)
| ID | Issue | Status |
|---|---|---|
| **H1** | Deactivated admin JWT still worked | **Fixed** — `assertActiveAdmin` |
| **H2** | Prod CORS permissive if unset | **Fixed** — fail boot without `CORS_ORIGINS` |
| **H3** | `MAX(ID)+1` race on product create | **Fixed** — `GET_LOCK` + transaction |
| **H4** | Seed admin on any non-prod host | **Fixed** — `ALLOW_DEV_ADMIN=1` only |

### Medium

#### M1 — Role-based access control — **Fixed**
- Superseded by store roles (A1): every staff route uses `requirePermission(module, level)`
- Staff-only reads (orders, customers, audit, delivery list) need View on that module
- Seeded: Homecare `admin` → Store Admin; `state_manager` / `region_manager` → Merchandiser (no deletes)

#### M2 — Packaging unit → `MeasurementUnitID` — **Fixed**
- Create/update resolve or insert `measurement_units`, set `products.MeasurementUnitID`

#### M3 — Missing inventory for new SKUs — **Mitigated**
- Best-effort variant + inventory inside create transaction

#### M4 — Public banners leaked drafts — **Fixed**
- Anonymous GET defaults to `published`

#### M5 — JWT in `localStorage` — **Fixed**
- Login sets HttpOnly `tx_admin_token`; portal uses `credentials: 'include'`
- Profile only in `localStorage`; `POST /auth/admin/logout` clears cookie
- API CSP + portal meta CSP

#### M6 — Admin login rate limit — **Fixed**
- In-memory 10 / 15 min per IP+email

#### M7 — Hardcoded API base — **Fixed**
- `VITE_API_BASE_URL`

#### M8 — Homepage CMS ≠ mobile — **Fixed**
- `HeroCarousel` ← `GET /cms/banners`
- Home section order/visibility ← `GET /cms/sections` (static fallback)

#### M9 — Cart IDOR by `cartId` — **Fixed**
- Mutations/summary/checkout call `assertCartAccess` (user JWT or `x-session-id`)
- Checkout ignores body `userId`

### Low — **Fixed** (post-P6)
| ID | Issue | Status |
|---|---|---|
| **L1** | Audit optimistic UI diverged if POST failed | **Fixed** — pending row removed on error + toast |
| **L2** | ApiExplorer POST samples were customer login | **Fixed** — admin login/logout + staff GETs |
| **L3** | Manual SQL easy to miss | **Fixed** — `server/sql/*.sql` + README |
| **L4** | Weak write validation | **Fixed** — `validate.ts` on product/banner/tier writes |
| **L5** | Relative banner URLs break on mobile | **Fixed** — `ASSET_BASE_URL` rewrite + portal publish warning + app resolve |

---

## 5. AuthZ matrix (current)

| Endpoint class | Anonymous | Customer JWT | Admin (cookie/Bearer) |
|---|---|---|---|
| Catalog/CMS/pricing **GET** | Yes | Yes | Yes |
| Catalog/CMS/pricing **write** | No | No | Module Edit (store role) |
| Catalog/CMS/pricing **delete** / sections reset | No | No | Module Delete (store role) |
| Cart mutate / summary / checkout | Owner session only | Owner | — |
| `GET /auth/users`, audit, orders admin, delivery list | No | No | Module View (store role) |
| Roles & access (`/access/*`) | No | No | Access View/Edit/Delete, no escalation |
| Admin login | Yes | — | — |

---

## 6. Security control checklist

| Control | Status |
|---|---|
| Portal UI requires login | Pass |
| Staff mutations require admin auth | Pass |
| HttpOnly session cookies | **Pass** |
| RBAC on destructive routes | **Pass** |
| Production CORS locked | Pass |
| Admin revoke immediate | Pass |
| Login rate limit | Pass (in-memory) |
| Cart ownership | **Pass** |

---

## 7. Recommended fix order

1. ~~**H1–H4 / M4 / M6 / M7**~~ — **Done**  
2. ~~**M1, M5, M2, M8, M9**~~ — **Done**  
3. ~~**Low L1–L5**~~ — **Done**  
4. Redis-backed rate limit if multi-node (optional ops)

---

## 8. Test plan (manual)

- [ ] Seed login only with `ALLOW_DEV_ADMIN=1`  
- [ ] Prod without `JWT_SECRET` / `CORS_ORIGINS` → refuse start  
- [ ] Login → cookie set; localStorage has profile only (no JWT)  
- [ ] Logout → cookie cleared; `/auth/admin/me` → 401  
- [ ] Merchandiser can create product; cannot DELETE product; staff with no role sees "No portal access yet"  
- [ ] Create product with unit `50 kg bag` → `MeasurementUnitID` set  
- [ ] Anonymous `GET /cms/banners` → published; app hero shows them  
- [ ] Disable a section in portal → mobile home omits it after refresh  
- [ ] Cart mutate with wrong `cartId` / no session → 403  
- [ ] Deactivate admin → next portal call logs out  

---

## 9. Conclusion

Portal + store API now have staff cookie sessions, per-module store roles, CMS-driven mobile home, unit persistence, and cart ownership checks. Remaining work is Low polish and ops hardening (Redis rate limit) before internet-facing deploy.
