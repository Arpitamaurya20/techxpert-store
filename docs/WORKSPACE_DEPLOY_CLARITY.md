# Workspace & Deploy Clarity — Techxpert Platform

**Purpose:** Lock where green work is edited and uploaded from.  
**Updated:** 24 Nov 2026 (after BLUE_GREEN port — green WIP lives in BLUE_GREEN only).

---

## 1. Rule (non-negotiable)

| Role | Path |
|---|---|
| **Edit / build / FileZilla green** | `/Users/satwik/Desktop/BLUE_GREEN/*` |
| **Normal product line** | `/Users/satwik/Desktop/techxpert-store`, `/Users/satwik/Desktop/Homecare/*` |
| **Do not** | Edit Desktop mains for unified-commerce / apitest experiments |

Branch for green code: `green/unified-commerce` in each BLUE_GREEN clone.  
Docs for app team: GitHub branch `docs/store-customer-api` (Store repo).

See also: root `/Users/satwik/Desktop/BLUE_GREEN/README.md`, [`APP_TEAM_GREEN_HANDOVER.md`](./APP_TEAM_GREEN_HANDOVER.md), [`GREEN_DEPLOY_MANIFEST.md`](./GREEN_DEPLOY_MANIFEST.md).

---

## 2. What is on disk (after port)

### Store — same GitHub remote, different jobs

| Path | Branch (typical) | Green PayU / bridge? |
|---|---|---|
| `BLUE_GREEN/techxpert-store-main/` | `green/unified-commerce` | **Yes** — upload from here |
| `Desktop/techxpert-store/` | `develop` (product line) | No — leave alone for green |

### Homecare backend

| Path | Branch (typical) | store-token / Activity? |
|---|---|---|
| `BLUE_GREEN/techxpert_backend-main/` | `green/unified-commerce` | **Yes** — upload from here |
| `Desktop/Homecare/backend/` | product feature branches | No green WIP in working tree |

### VPS

| | Blue (prod) | Green (test) |
|---|---|---|
| Root | `/var/www/node-projects/` | `/var/www/green-node/` |
| Store API | → `store.jiotechxpert.com` | → `apitest.jiotechxpert.com` |
| Homecare API | → live Homecare hosts | → `apitest.techxpertindia.com` |
| DBs | `techxpertstore` / `homecare` | `techxpertstore_green` / `homecare_green` |

---

## 3. Why BLUE_GREEN exists

Green / unified-commerce / apitest work must not disturb the main product folders. Agents once edited Desktop mains instead; that WIP was **ported into BLUE_GREEN** and Desktop cleaned. Keep it that way.

---

## 4. Upload reminder

1. Build Store: `BLUE_GREEN/techxpert-store-main/server` → `npm run build` → upload `dist/` + `sql/`.  
2. Homecare: upload listed `src/` + `sql/feature_flags.sql` from BLUE_GREEN backend.  
3. Run green SQL + set OTP SMS env (see app handover §0) before telling the app team green login works.
