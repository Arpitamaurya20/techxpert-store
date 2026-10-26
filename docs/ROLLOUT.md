# Production rollout and rollback

Plan item 7 in [`PROJECT_STATUS.md`](./PROJECT_STATUS.md). For whoever has production access: database, API host and portal host. Nothing here touches the `homecare` schema; the API only reads it.

The order is **database, then API and portal together, then the phone build**. Every step has a check. Stop at the first check that fails.

---

## 0. Before the day

- [ ] **Code:** deploy what is on `develop`, or `main` once `develop` is merged into it. Note the commit you deploy and the commit now live, for rollback.
- [ ] **Backup:** take a full backup of the `techxpertstore` database. `portal_staff.sql` (step 3.2) has no undo, so also export its two tables on their own, right before running it:
  ```bash
  mysqldump -u <user> -p techxpertstore portal_staff_roles portal_staff_scope > staff_tables_before_a3.sql
  ```
- [ ] **Server settings:** get them ready (section 2). The API refuses to start in production without `JWT_SECRET` and `CORS_ORIGINS`.
- [ ] **The first super admin:** decide who it is, and whether they get a new store login or keep their Homecare login. See step 3.3.
- [ ] **Quiet time:** pick one. Everyone on the portal is signed out at step 3, and checkout is briefly unavailable while the API restarts.

## 1. Database

Run from `server/`, against the MySQL host that has both `homecare` and `techxpertstore`. Before each script, run the read-only check next to it to see whether that step is already done.

| # | Script | Already done if… | Notes |
|---|---|---|---|
| 1.1 | `sql/portal_audit_logs.sql` | `SHOW TABLES IN techxpertstore LIKE 'portal_audit_logs'` returns a row | Safe to run again |
| 1.2 | `sql/shop_s3_checkout.sql` | `SHOW COLUMNS FROM techxpertstore.orders LIKE 'CartID'` returns a row | **Not** safe to run again; it fails if `CartID` exists. Must come before 1.4 |
| 1.3 | `sql/portal_access.sql` | `SHOW TABLES IN techxpertstore LIKE 'portal_roles'` returns a row | Safe to run again; seeds the Merchandiser and Store Admin roles |
| 1.4 | `sql/portal_scope.sql` | `SHOW TABLES IN techxpertstore LIKE 'store_pincodes'` returns a row and the query below returns 0 | Safe to run again. See below |
| 1.5 | `sql/saved_items.sql` | `SHOW TABLES IN techxpertstore LIKE 'saved_items'` returns a row | Safe to run again. The previous API ignores the table |
| 1.6 | `sql/help_content.sql` | `SHOW TABLES IN techxpertstore LIKE 'help_contact'` returns a row | Safe to run again. After the audit table exists. The page starts empty |
| 1.7 | `sql/home_merch.sql` | `SHOW TABLES IN techxpertstore LIKE 'home_shortcuts'` returns a row | Safe to run again. The shortcut row and project tiles start empty |
| 1.8 | `sql/product_page.sql` | `SHOW TABLES IN techxpertstore LIKE 'product_highlights'` returns a row | Safe to run again. Highlights and specifications start empty. The previous API ignores the tables |
| 1.9 | `sql/search_suggestions.sql` | `SHOW TABLES IN techxpertstore LIKE 'search_suggestions'` returns a row | Safe to run again. Search ideas start empty. The previous API ignores the table |
| 1.10 | `sql/trust_claims.sql` | `SHOW TABLES IN techxpertstore LIKE 'trust_claims'` returns a row | Safe to run again. Trust-strip claims start empty. The previous API ignores the table |
| 1.11 | `sql/about_page.sql` | `SHOW TABLES IN techxpertstore LIKE 'about_page'` returns a row | Safe to run again. After the audit table exists. The About page starts empty. The previous API ignores the tables |
| 1.12 | `sql/policies.sql` | `SHOW TABLES IN techxpertstore LIKE 'policy_pages'` returns a row | Safe to run again. After the audit table exists. The four policy pages start empty. The previous API ignores the tables |
| 1.13 | `sql/home_deals.sql` | `SHOW TABLES IN techxpertstore LIKE 'home_deals'` returns a row | Safe to run again. Deals tiles start empty. The previous API ignores the table |
| 1.14 | `sql/quantity_step.sql` | `SHOW COLUMNS FROM techxpertstore.products LIKE 'QuantityStep'` returns a row | Safe to run again. Existing products stay at 1 |
| 1.15 | `sql/store_variant_stock.sql` | `SHOW TABLES FROM techxpertstore LIKE 'store_variant_stock'` returns a row | Safe to run again. No rows means every store still sells the company stock |
| 1.16 | `sql/shop_settings.sql` | `SHOW TABLES FROM techxpertstore LIKE 'shop_settings'` returns a row | Safe to run again. After the audit table exists. Missing rows keep delivery ₹99, free from ₹2,000, GST 18% |
| 1.17 | `sql/talk_requests.sql` | `SHOW TABLES FROM techxpertstore LIKE 'talk_requests'` returns a row | Safe to run again. After the audit table exists. An empty queue is the start |
| 1.18 | `sql/order_source.sql` | `SHOW COLUMNS FROM techxpertstore.orders LIKE 'OrderSource'` returns a row | Run once. Existing orders are tagged `app`. Skip the statement if the column is already there |
| 1.19 | `sql/staff_alerts.sql` | `SHOW TABLES FROM techxpertstore LIKE 'staff_alerts'` returns a row | Safe to run again. Starts empty. A missing table does not stop an order or a request |
| 1.20 | `sql/order_messages.sql` | `SHOW TABLES FROM techxpertstore LIKE 'order_messages'` returns a row | Safe to run again. Confirmation starts off. A missing table does not stop an order |
| 1.21 | `sql/delivery_promise.sql` | `SHOW TABLES FROM techxpertstore LIKE 'order_problems'` returns a row | Safe to run again. Run after 1.19. Arrives in starts off. A missing table does not stop an order |
| 1.22 | `sql/order_channel.sql` | `SHOW TABLES FROM techxpertstore LIKE 'order_channel'` returns a row | Safe to run again. A missing table does not stop an order. Null means staff, or an order from before this |

`sql/portal_audit_logs_alter_category.sql` can be skipped: 1.3 and 1.4 make the same change. `sql/portal_staff.sql` is **not** run here, because it renames a column that the live API reads. It runs in step 3.2, right before the restart.

```bash
mysql -u <user> -p < sql/<script>.sql
```

**Step 1.4:** when there is exactly one active store, `portal_scope.sql` links every delivery pincode to it. When there are several stores and some pincodes have no store, it creates the tables and then **stops with an error**. Link each pincode to its store and run it again:

```sql
-- Active pincodes still without a store (must be 0 before the API restart, or checkout refuses them):
SELECT p.ID, p.Pincode FROM techxpertstore.pincodes p
LEFT JOIN techxpertstore.store_pincodes sp ON sp.PincodeID = p.ID AND sp.IsActive = 1
WHERE p.IsActive = 1 AND sp.ID IS NULL;

-- Link one:
INSERT INTO techxpertstore.store_pincodes (StoreID, PincodeID) VALUES (<store id>, <pincodes.ID>);
```

**Check after section 1:** each "already done if…" query in the table now passes.

## 2. Server settings

Set these for the API process (`NODE_ENV=production`):

| Setting | Value | Why |
|---|---|---|
| `NODE_ENV` | `production` | Turns on the checks below, `Secure` cookies, and turns off the seed admin and the file-store fallback |
| `JWT_SECRET` | 24+ random characters, unique to production | The API won't start without it |
| `CORS_ORIGINS` | The portal's address, e.g. `https://admin.example.in` (comma-separated if several) | The API won't start without it |
| `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD` | Production MySQL | — |
| `DB_STORE`, `DB_USERS` | Only if the schemas aren't named `techxpertstore` and `homecare` | — |
| `PORT` | The API's port | — |
| `PUBLIC_API_ORIGIN` | The API's public address, e.g. `https://api.example.in` | Banner images uploaded in the portal (`/uploads/…`) are sent to the phone as full addresses |
| `ASSET_BASE_URL` | Where other relative banner images live, if any | Optional |

**Must not be set:** `ALLOW_DEV_ADMIN` and `ALLOW_FILE_STORE`. Both are ignored when `NODE_ENV=production`, but they shouldn't be there.

**Banner uploads:** these are saved in `uploads/` under the folder the API is started from (normally `server/`). That folder must survive deploys and be in the backups.

**Same site:** the sign-in cookie is `SameSite=Lax`, so put the portal and API on the same site (for example `admin.` and `api.` of one domain). The portal also sends the sign-in token in a header, so sign-in works either way.

## 3. API and portal (deploy together)

The A3 API needs the A3 portal (staff list, first-sign-in screen), so they ship together.

1. [ ] **Build both.** Nothing goes live yet.
   - API: in `server/`, run `npm ci`, then `npm run build` (output in `dist/`).
   - Portal: in `web/`, run `npm ci`, then `VITE_API_BASE_URL=https://<api address> npm run build` (output in `web/dist/`).
2. [ ] **Staff tables** (the quiet window starts here):
   - Export the two tables (step 0).
   - Run `mysql -u <user> -p < sql/portal_staff.sql`. It removes the role and place rows that were copied from Homecare, because people are now added or linked on purpose. If the live API already has roles (A1 or A2 code), it can't check portal access from this point, so go straight on.
3. [ ] **First super admin**, once, in a terminal on the API host with the section 2 settings loaded:
   ```bash
   node dist/scripts/staffBootstrap.js     # or: npm run staff:bootstrap  (needs dev dependencies, it uses tsx)
   ```
   - It shows any active super admins, then offers a new store login (name, email, password typed twice and never shown) or a link to the person's Homecare login.
   - An email that already has a store login, or is already linked, is offered a promotion instead.
4. [ ] **Go live together:**
   - Start the API from `server/` with `npm start` (`node dist/index.js`) under your process manager.
   - Publish `web/dist/` as static files. The portal uses `#` routes, so no server rewrites are needed.
   - Everyone signs in again.

**Check after section 3:**

- [ ] `GET https://<api>/health` returns 200, and both databases read `ok`.
- [ ] The super admin signs in to the portal. `admin@techxpert.in` / `admin123` is refused.
- [ ] Every sidebar screen opens without "Couldn't load …".
- [ ] Roles & access lists only the super admin.
- [ ] An unlinked Homecare email is refused at sign-in.
- [ ] Stores & groups shows each store with its pincodes. The query in step 1.4 still returns 0.
- [ ] `GET https://<api>/delivery/pincodes/<a served pincode>` says it is served.
- [ ] One real portal change (for example hiding then showing a home block) appears in the Audit trail.
- [ ] **Read-only desk proof** against production, using values that are live right now (a published banner, the first home blocks, an existing bulk price):
  ```bash
  PROOF_API=https://<api> PROOF_BANNER="<a live banner>" PROOF_SECTIONS=<first two blocks> \
  PROOF_PRODUCT=<product id> PROOF_TIER=<minQty>:<discountValue> npm run proof:desk
  ```
  It must exit 0. Without dev dependencies, run `node dist/scripts/deskProof.js` with the same settings. It only reads the public API, so it can run from any machine.

Then the super admin adds staff (store logins, or links for people who also work in Homecare), gives each a role, and gives each their places in Roles & access. Staff with a role but no places see no orders, pincodes or customers.

## 4. Phone build (app team)

- [ ] Build with `EXPO_PUBLIC_API_BASE_URL=https://<api>` (HTTPS), plus `EXPO_PUBLIC_ASSET_BASE_URL` if the app's assets are hosted.
- [ ] `app/eas.json` has only an internal `preview` profile (Android APK). A store release needs a production profile; the app team owns this.
- [ ] Sign-in uses `send-otp` then `verify-otp`, not `POST /auth/login` ([`APP_API_GUIDE.md`](./APP_API_GUIDE.md) UC-7).
- [ ] Device run of plan item 2 (guest cart, merge on sign-in, pincode check, order, repeat tap) against the production API, before release.

## 5. Rollback

| Went wrong at | Do |
|---|---|
| Section 1 | Nothing to undo. The scripts only add tables, columns and roles, and the old API ignores them. |
| Step 3.2 or later | Restore the two staff tables: `mysql -u <user> -p techxpertstore < staff_tables_before_a3.sql`. The old API reads the `AdminID` column, which `portal_staff.sql` renamed. `portal_staff` can stay, because the old API ignores it. Then do the next row. |
| Step 3.4 (API or portal) | Put the previous API **and** portal back together, after restoring the staff tables. |
| Section 4 (phone) | Stop the release. Nothing on the server needs undoing. |

**Locked out after rollout:**

- A store login forgot their password: another super admin resets it in Roles & access.
- The only super admin forgot theirs: run step 3.3 again to make a second super admin, who resets the first.
- A linked super admin: their password is reset in Homecare.

## 6. Known before going live

From [`PROJECT_STATUS.md` §7](./PROJECT_STATUS.md):

- 110,100 of 110,106 active products have no active price, so they can't be ordered until merchandisers price them.
- Bulk prices 1–3 belong to a removed product and never apply. Remove or re-point them.
- The admin sign-in rate limit is held in memory, so it only works on a single API instance.
- Not device-tested yet: plan item 2.
- **Phone sign-in can't work yet in production.** Production refuses `POST /auth/login` and the local code `123456`, so the app must use `send-otp` then `verify-otp`, and the server has no SMS sender to text the code. Both are needed before customers can sign in. Guest checkout still works without them.
