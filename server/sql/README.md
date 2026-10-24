# Store MySQL ops scripts

Run against the same MySQL instance that hosts `homecare` + `techxpertstore`, in this order. None of them reads or changes the `homecare` schema.

```bash
cd server
mysql -u root -p < sql/portal_audit_logs.sql
mysql -u root -p < sql/portal_audit_logs_alter_category.sql   # only if the table predates 'category' / 'delivery' / 'access'
mysql -u root -p < sql/shop_s3_checkout.sql
mysql -u root -p < sql/portal_access.sql
mysql -u root -p < sql/portal_scope.sql   # before restarting the API on the A2 code
mysql -u root -p < sql/portal_staff.sql   # before restarting the API on the A3 code; back up portal_staff_roles and portal_staff_scope first
mysql -u root -p < sql/saved_items.sql    # customer wishlist; safe to run again; the previous API ignores it
mysql -u root -p < sql/help_content.sql   # help page, empty until staff fill it; safe to run again; after the audit table exists
npm run staff:bootstrap                   # once: the first super admin (also the way back in if the only super admin is locked out)
```

`portal_staff.sql` empties the staff role and places tables (they held Homecare admin ids) and has no undo script. Deploy the A3 API and portal together after it. Rollout, rollback and lock-out recovery: [`docs/PORTAL_ACCESS.md`](../../docs/PORTAL_ACCESS.md) §A3. Full production checklist (when to run each script, settings, checks): [`docs/ROLLOUT.md`](../../docs/ROLLOUT.md).

| Script | Purpose |
|---|---|
| `portal_audit_logs.sql` | Create audit table (fixes `GET /audit/logs` 503) |
| `portal_audit_logs_alter_category.sql` | Bring an older table's entity ENUM up to date |
| `shop_s3_checkout.sql` | `orders.CartID` (unique) and cart status `ordered` — one order per cart (shop S3) |
| `portal_access.sql` | Store roles, module permissions and staff assignments, with the two seeded roles (portal access A1); adds `access` to audit entities |
| `portal_scope.sql` | Groups tree, store placement, store↔pincode links, staff places, whole-company switch, `orders.StoreID`, `stores` module grants (portal access A2); adds `store` to audit entities. Links existing pincodes and orders when there is exactly one store; otherwise stops until pincodes are linked |
| `portal_staff.sql` | Store-owned staff list `portal_staff`: store logins and linked Homecare logins (portal access A3). Removes the store roles that A1 copied from Homecare roles, and renames `AdminID` to `StaffID` in the staff role and places tables |
| `saved_items.sql` | Customer and guest wishlists (`saved_items`). Safe to run again |
| `help_content.sql` | Help page (`help_contact`, `help_faqs`) and the `help` audit label. Starts empty. Safe to run again |

Optional env for mobile-friendly banner images (relative `/images/...` paths):

```
ASSET_BASE_URL=http://localhost:5173
```

(or your CDN / public web origin). The API rewrites relative `imageUrl` values on banner responses.
