# Store MySQL ops scripts

Run against the same MySQL instance that hosts `homecare` + `techxpertstore`, in this order. None of them changes the `homecare` schema; `portal_access.sql` only reads `homecare.admin_users` to seed assignments.

```bash
cd server
mysql -u root -p < sql/portal_audit_logs.sql
mysql -u root -p < sql/portal_audit_logs_alter_category.sql   # only if the table predates 'category' / 'delivery' / 'access'
mysql -u root -p < sql/shop_s3_checkout.sql
mysql -u root -p < sql/portal_access.sql
mysql -u root -p < sql/portal_scope.sql   # before restarting the API on the A2 code
```

| Script | Purpose |
|---|---|
| `portal_audit_logs.sql` | Create audit table (fixes `GET /audit/logs` 503) |
| `portal_audit_logs_alter_category.sql` | Bring an older table's entity ENUM up to date |
| `shop_s3_checkout.sql` | `orders.CartID` (unique) and cart status `ordered` — one order per cart (shop S3) |
| `portal_access.sql` | Store roles, module permissions, staff assignments + seed (portal access A1); adds `access` to audit entities |
| `portal_scope.sql` | Groups tree, store placement, store↔pincode links, staff places, whole-company switch, `orders.StoreID`, `stores` module grants (portal access A2); adds `store` to audit entities. Links existing pincodes and orders when there is exactly one store; otherwise stops until pincodes are linked |

Optional env for mobile-friendly banner images (relative `/images/...` paths):

```
ASSET_BASE_URL=http://localhost:5173
```

(or your CDN / public web origin). The API rewrites relative `imageUrl` values on banner responses.
