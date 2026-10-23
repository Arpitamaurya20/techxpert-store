# Portal access — roles, modules and scope

Who can open which part of the merchandising portal, and (from A2) whose data they see.

Two phases. Each is finished and verified before the next starts.

| Phase | What | Status |
|-------|------|--------|
| **A1** | Store roles with per-module View / Edit / Delete; assign a role to existing staff; portal shows only what the role allows | **Done** (local DB + browser proof, 23 Oct 2026) |
| **A2** | Stores and the pincodes they serve, a free tree of groups above stores, staff scope, orders tagged with a store and filtered by scope | Done (23 Oct 2026) |
| **A3** | Store-owned staff list: store-only logins, plus linked Homecare logins for people who work in both | Server built (S1, 23 Oct 2026); portal screens (S2) next. See [A3](#a3--store-owned-staff-accounts) |

Nothing here changes the Homecare database. Until A3, `homecare.admin_users` is the login table; its `role` column is read for one thing only: `super_admin` always has full access. In A3 the store keeps its own staff list, and reads a Homecare login only for people deliberately linked to it.

---

## A1 — Roles and module permissions

### Decisions

| Question | Answer |
|----------|--------|
| Levels | View, Edit, Delete per module. Edit or Delete implies View. |
| Accounts | Assign a store role to an existing `admin_users` login. Creating logins stays in Homecare. |
| One role per person | Yes. |
| Hierarchy | No escalation: you can only create, change or assign a role whose permissions are all within your own. You cannot change your own role, a role you hold, or someone whose role is above yours. |
| Super admin | `admin_users.role = 'super_admin'` has every permission and cannot be assigned a store role. |
| Existing staff | Seeded: **Store Admin** (everything) for Homecare `admin`; **Merchandiser** for Homecare `state_manager` and `region_manager`. Everyone else has no portal access until assigned. |

### Modules

| Key | Portal tab | View | Edit | Delete |
|-----|-----------|------|------|--------|
| `products` | Products & Inventory | ✓ | create, edit price/stock | delete product |
| `categories` | Categories & Subs | ✓ | create, rename, reorder | delete |
| `orders` | Orders & Fulfillment | order list, order detail, stats | change status | — |
| `delivery` | Delivery Pincodes | list | add, pause, resume | — |
| `customers` | Customers | list | — | — |
| `pricing` | Bulk Pricing Rules | ✓ | create, edit tier | delete tier |
| `banners` | Campaign Banners | ✓ | create, edit, publish, upload, reorder | delete |
| `sections` | Homepage Sections | ✓ | show/hide, reorder | reset to defaults |
| `audit` | Audit Trail | list | — | — |
| `access` | Roles & Access | roles and staff | create/edit roles, assign staff | delete role |

The **Developer tools** tab (endpoint tester, phone app connection) is not a module: only super admin sees it. The former `api` module was removed on 23 Oct 2026; any stored `api` rows are ignored.

The Dashboard shows to anyone with at least one module, and only shows tiles for modules they can view. Catalogue, banners, sections and tier reads stay public because the phone uses them; only the staff-only reads (orders, customers, audit, delivery list) are gated.

### Tables (`techxpertstore`)

```
portal_roles             ID, Name (unique), Description, CreatedBy, CreatedAt, UpdatedBy, UpdatedAt
portal_role_permissions  RoleID, Module, CanView, CanEdit, CanDelete      PK (RoleID, Module)
portal_staff_roles       AdminID (PK, = homecare.admin_users.admin_id), RoleID, AssignedBy, AssignedAt
```

`server/sql/portal_access.sql` creates them, seeds the two roles and the assignments, and adds `access` to the audit entity list.

### API

| Method | Path | Needs |
|--------|------|-------|
| GET | `/auth/admin/me`, POST `/auth/admin/login` | — (response now carries `storeRole` and `permissions`) |
| GET | `/access/roles` | access view — modules catalogue + roles with permissions and staff count |
| POST | `/access/roles` | access edit |
| PUT | `/access/roles/:id` | access edit |
| DELETE | `/access/roles/:id` | access delete; refused while anyone holds the role |
| GET | `/access/staff` | access view — active Homecare staff with their store role |
| PUT | `/access/staff/:adminId` | access edit — `{ roleId }` or `{ roleId: null }` to remove |

Every other staff route uses `requirePermission(module, level)` instead of the old fixed role lists. A refusal is 403 with a sentence naming the module, e.g. "You don't have edit access to Orders."

Role and staff changes are written to the audit trail server-side (entity `access`). Portal audit entries now record the signed-in staff member from the session, not a name sent by the browser.

### Portal

- Sidebar and hash routes show only modules the role can view; an unknown or forbidden hash falls back to the first allowed tab.
- Edit and delete controls are hidden when the role lacks them (the server refuses anyway).
- Data for a module is only fetched when it can be viewed.
- New **Roles & Access** tab: Roles (list, create, edit the module grid, delete) and Staff (each active login, its store role, change it).
- Staff with no role see a "No portal access yet — ask a store admin to assign you a role" screen.

### As built (A1)

- Rules: `server/src/utils/permissions.ts` (+ tests). Service: `server/src/services/accessService.ts`. Routes: `server/src/routes/access.ts`.
- `requireAdmin` now loads the person's permissions from the tables on every request, so a role change applies on their next action; the token never carries permissions.
- If the access tables are missing, every non-super-admin staff call returns 503 "Portal access settings are unavailable…". Super admin still works.
- Portal: `web/src/services/access.ts`, `web/src/components/AccessManager.tsx`; `services/roles.ts` removed.
- Proof (local DB): Merchandiser refused on Roles & Access, product delete and pincode add, allowed on orders and product edit; no-role login refused on orders, customers, audit; a limited "access clerk" could not grant, edit or assign beyond its own grants, edit its own role, or change itself; held roles cannot be deleted; audit actor comes from the session. Browser: Merchandiser sees no Roles tab and no Delete; no-role login gets the no-access screen; a role created and assigned in the UI showed only its modules to that person. Test rows removed afterwards.

**Production:** run `server/sql/portal_audit_logs.sql` (if not already), then `server/sql/portal_access.sql`, then restart the API.

---

## A2 — Stores, groups and scope

### Decisions (agreed)

| Question | Answer |
|----------|--------|
| Pincode → store | Exactly one active store-pincode link per pincode. Moving a pincode: deactivate the old link, create a new one. |
| Stock | Shared company stock for now. Per-store stock is a later step. |
| Levels above stores | A free tree of **groups** (Zone, Area, Cluster, or any name): staff create, rename and nest groups, and move stores or groups anywhere in the tree. Max depth 8 (enforced server-side). |
| Staff scope | A role + either **Whole company** (explicit switch) or one or more scope nodes (stores or groups). No switch and no nodes = sees no orders, pincodes or customers. A scope node includes all stores under it, including ones added later. You can only assign a scope that is entirely within your own, and cannot change someone whose scope is wider than yours. Existing staff start as Whole company. |
| What scope filters | Orders (by `StoreID` recorded at checkout), delivery pincodes (by the store linked to the pincode), customers (users who placed at least one order from a store in scope). Catalogue, banners, sections, pricing — company-wide always. |
| Checkout change | After the pincode is validated, we also resolve the active store for that pincode and write `StoreID` on the order row (cart checkout and the older `POST /orders`). COD and total checks are unchanged. If no store is linked, or the store is inactive, the order is refused (409, same sentence as an unserviceable pincode). The migration links existing pincodes so checkout never stops. |
| Stores & Groups permission | New module `stores` (View / Edit / Delete), separate from Delivery Pincodes. |
| Creating stores | In the portal: name, contact, address, the store's own pincode; `ID`, `StoreCode` and the landmark are generated. |
| Existing `pincodes` table | It links to `areas` (geographic). We do **not** change it. A new `store_pincodes` join table links pincodes to stores independently. |
| Existing `user_store_mapping` | Maps customer `users` to stores. We do not change it or use it for staff scope; it is a separate Homecare concept. |
| A2 audit | Group, store and pincode-link changes written to `portal_audit_logs` as entity `store`; staff places as entity `access`. |

### Review of this design (23 Oct 2026) — fix before build

Checked against the code and the local DB (MySQL 9.6). The shape below (groups tree, store↔pincode links, staff scope, `orders.StoreID`) stands; these points change it.

| # | Problem | Fix |
|---|---|---|
| R1 | `UNIQUE (PincodeID, IsActive)` also blocks a **second inactive** link, so the second time a pincode moves, unlinking fails. | Stored generated column `ActivePincodeID = IF(IsActive = 1, PincodeID, NULL)` with `UNIQUE` on it (many NULLs allowed). |
| R2 | Foreign keys are written inline (`col INT REFERENCES t(ID)`). MySQL 8 parses and **ignores** that form; production may not be 9.x. | Table-level `FOREIGN KEY … REFERENCES …` everywhere. |
| R3 | "Zero scope rows = company-wide" fails open: removing someone's last place gives them everything, and a scoped manager could "assign" company-wide by clearing the list. | Explicit whole-company flag; zero places and no flag = sees no orders, pincodes or customers (**decision D2**). |
| R4 | Unlinked pincode → order refused, and rollout links pincodes *after* the API restart: **checkout stops for everyone** between deploy and linking. | `portal_scope.sql` links every active pincode to the store when exactly one store exists, and stops with a message when there are more (**decision D1**). |
| R5 | No way to create a store. `stores` has one row, `ID` is not auto-increment and `LandmarkID` is required, so a second store can't be added from the portal. Your two-store example needs this. | **Decision D3.** |
| R6 | The tree is managed with the `delivery` permission, so anyone who may add pincodes may restructure the company. | Separate `stores` module (View / Edit / Delete) (**decision D4**). |
| R7 | No-escalation rule for scope is only "assign inside your own". A1 also refuses changing someone who holds more. | Also refuse changing the scope of someone whose scope is wider than yours. |
| R8 | Out-of-scope order detail returns 403, which reveals the order exists. `GET /orders/stats` (dashboard) and `PUT /orders/:id/status` are not listed. | 404; stats and status change filtered too. |
| R9 | Factual errors: checkout does not resolve a `LandmarkID` (it validates the pincode string); the refusal is **409**, not 422; the customers list is `GET /auth/users`, not `/customers`; `/delivery/pincodes/search` does **not** exist (routes are `GET /pincodes`, `GET /pincodes/:pincode`, `POST /pincodes`, `PATCH /pincodes/:id`); the older `POST /orders` path also writes orders and needs the store. | Corrected in the build; the search endpoint is new work. |

**Decisions answered (23 Oct 2026):**

- **D1:** refuse unlinked pincodes; `portal_scope.sql` links all active pincodes to the store when exactly one exists, otherwise stops with a message.
- **D2:** explicit Whole-company switch; existing staff start as whole company; no places = no scoped data.
- **D3:** stores created in the portal.
- **D4:** new `stores` module.

Where the sections below disagree with R1–R9 or D1–D4, the review and decisions win.

### As built (A2, 23 Oct 2026)

This section is what the code does. The draft sections after it (tables, API, screens, files) are kept for history; where they differ, this wins.

**Tables** (`server/sql/portal_scope.sql`, techxpertstore only, re-runnable):

- `store_groups` (ID, Name, Kind, ParentID): the free tree. Names are unique among siblings; nesting is capped at 8 levels in the server.
- `store_group_stores` (StoreID primary key, GroupID): where a store sits. No row means top level.
- `store_pincodes` (StoreID, PincodeID, IsActive): which store serves a pincode. A generated `ActivePincodeID` with `UNIQUE` allows one active link per pincode and any number of old ones (R1).
- `portal_staff_scope` (AdminID, NodeType `group`/`store`, NodeID): a person's places.
- `portal_staff_roles.ScopeAll`: the whole-company switch. The migration sets it to 1 for existing staff (D2).
- `orders.StoreID`: written at checkout. The migration fills it for existing orders when there is one store.
- The migration links every active pincode to the store when exactly one store exists, and stops with an error when there is more than one store and some pincode is unlinked (D1).
- It also grants `stores` (View/Edit/Delete) to Store Admin and View to Merchandiser, and adds `store` to the audit entity list.

**Rules** (`server/src/utils/scope.ts` and its tests):

- Places are loaded from the tables on every request (`AccessService.forAdmin`), never from the token.
- A group covers every group and store under it, including ones added later.
- Super admin is always whole company. A person with a role, no places and no switch sees no orders, pincodes or customers.
- Orders, order detail, status change and order stats are limited to stores in your places; anything outside answers 404.
- Delivery pincodes are limited by the store that serves them. Customers are limited to people with an order from your stores, and their spend counts only those orders.
- No escalation:
  - places you give must be inside your own;
  - only whole-company staff can give whole company;
  - you can't change someone whose places are wider than yours or whose role holds more than yours;
  - you can't change yourself;
  - super admin can't be scoped (409).

**API:**

| Route | Needs |
|---|---|
| `GET /stores/tree`: groups and stores inside your places, plus `wholeCompany` | Stores view |
| `POST /stores/groups`, `PUT /stores/groups/:id` (rename, kind, move) | Stores edit |
| `DELETE /stores/groups/:id`: refused (409) while it has groups, stores or staff | Stores delete |
| `POST /stores`: name, group, the store's own pincode, contact; ID, `ST000n` code and landmark generated | Stores edit |
| `PUT /stores/:id`: details, move group; `active:false` refused while it serves pincodes | Stores edit (+ delete to deactivate) |
| `GET /stores/:id/pincodes`, `POST /stores/:id/pincodes` (moves the pincode from its old store if that store is in your places), `DELETE /stores/:id/pincodes/:pincodeId` | Stores view / edit |
| `PUT /access/staff/:adminId/scope` `{ all, nodes: [{type, id}] }` | Roles & Access edit |

**Other changes:**

- Checkout (cart and older `POST /orders`) refuses with 409 "We don't deliver to X yet." when the pincode has no active link or its store is inactive.
- `GET /delivery/pincodes` returns `storeId` and `storeName`. `POST /delivery/pincodes` takes an optional `storeId`, which scoped staff must give.
- Orders and order detail return `storeId` and `storeName`. `/auth/admin/me` and login return `wholeCompany`.
- Audit: group, store and pincode-link changes are logged with entity `store`; staff places changes with entity `access`.

**Portal:**

- New **Stores & Groups** tab (`StoreTreeManager.tsx`). On the left is the tree of your places, with add, rename and move for groups and stores. On the right are the selected store's details and its pincodes (serve, stop serving, earlier links).
- Whole-company staff also see New group and New store at the top level.
- **Roles & Access**: each staff row shows their places. A **Places** button (needs Roles & Access edit and Stores view) opens a checklist of your own groups and stores. Anything under a ticked group shows as covered. Whole company can only be ticked by whole-company staff.
- **Delivery Pincodes**: a "Served by" store column, and a store picker when adding.
- **Orders**: a Store column, also shown in the order detail.

**Proof (local DB):**

- Server: tsc clean; 71/71 unit tests.
- HTTP script: 61/61 checks with three scoped staff, then exact cleanup. It covered:
  - migration guard and idempotency;
  - group, store and link creation and moves;
  - order `StoreID`;
  - scoped orders, detail, status and stats (404 outside);
  - scoped delivery list, pause and add, and scoped customers;
  - escalation refusals;
  - delete and deactivate rules;
  - audit rows.
- Browser:
  - Store Admin created a group and a store inside it, and moved pincode 201016 to the new store.
  - Store Admin set Merchandiser test-up's places to the group.
  - test-up then saw only that group and store (view only), 0 orders, 0 customers, and only 201016 under Delivery.
- Test rows were removed afterwards.

**Production:** run `server/sql/portal_scope.sql` **before** restarting the API on the A2 code. If the database has more than one store, link each active pincode to a store first, or the script stops.

---

### New tables (`techxpertstore`)

#### `store_groups` — free-position tree nodes

```sql
CREATE TABLE store_groups (
  ID          INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  Name        VARCHAR(100) NOT NULL,
  ParentID    INT          NULL REFERENCES store_groups(ID),  -- NULL = root
  SortOrder   SMALLINT     NOT NULL DEFAULT 0,
  CreatedBy   INT          NULL,
  CreatedAt   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedBy   INT          NULL,
  UpdatedAt   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

Rules:
- Name unique within the same parent.
- A group cannot be moved to one of its own descendants (cycle check server-side).
- Max depth 8 from root.
- Deleting a group is refused while it has children or stores; must clear children first.

#### `store_group_stores` — places a store in the tree

```sql
CREATE TABLE store_group_stores (
  GroupID  INT NOT NULL REFERENCES store_groups(ID),
  StoreID  INT NOT NULL REFERENCES stores(ID),
  PRIMARY KEY (StoreID)   -- a store belongs to exactly one group (or no group = top-level)
);
```

A store with no row here is **top-level** (visible to company-wide scope, no group). This is valid.

#### `store_pincodes` — which pincodes a store serves

```sql
CREATE TABLE store_pincodes (
  ID          INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  StoreID     INT          NOT NULL REFERENCES stores(ID),
  PincodeID   INT          NOT NULL REFERENCES pincodes(ID),
  IsActive    TINYINT(1)   NOT NULL DEFAULT 1,
  CreatedBy   INT          NULL,
  CreatedAt   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedBy   INT          NULL,
  UpdatedAt   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_active_pincode (PincodeID, IsActive)  -- enforces one active store per pincode
);
```

The unique key on `(PincodeID, IsActive)` prevents two active links for the same pincode. (MySQL allows multiple rows with `IsActive=0` since the key isn't a partial index; an app-level check confirms no active duplicate before insert.)

#### `portal_staff_scope` — scope nodes for each staff member

```sql
CREATE TABLE portal_staff_scope (
  ID        INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  AdminID   INT NOT NULL,  -- homecare.admin_users.admin_id
  NodeType  ENUM('store','group') NOT NULL,
  NodeID    INT NOT NULL,
  AssignedBy INT NULL,
  AssignedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_admin_node (AdminID, NodeType, NodeID)
);
```

Zero rows for an AdminID = company-wide. The server always evaluates scope at request time from these rows (never cached in the token).

#### `orders` — add `StoreID`

```sql
ALTER TABLE orders ADD COLUMN StoreID INT NULL REFERENCES stores(ID);
ALTER TABLE orders ADD INDEX idx_orders_store (StoreID);
```

NULL only for orders placed before A2 (pre-migration data). All orders placed after A2 deployment must have a StoreID; the API refuses if the pincode has no active store link.

---

### Scope resolution algorithm (server-side, used on every scoped request)

```
function storeIDsForAdmin(adminID):
  rows = SELECT NodeType, NodeID FROM portal_staff_scope WHERE AdminID = adminID
  if rows is empty:
    return ALL_STORES          -- company-wide
  storeIDs = set()
  for row in rows:
    if row.NodeType == 'store':
      storeIDs.add(row.NodeID)
    else:                       -- group
      storeIDs.addAll(descendantStores(row.NodeID))  -- recursive
  return storeIDs
```

`descendantStores(groupID)` does a recursive CTE on `store_groups` and then joins `store_group_stores`.

Super admin bypasses scope entirely (same as today for permissions).

---

### Checkout change (server)

Current flow in `cartCheckoutService.ts`:
1. Validate pincode → get `LandmarkID` from `deliveryAreaService`.
2. Write order with `LandmarkID`.

A2 adds between steps 1 and 2:
- `SELECT sp.StoreID FROM store_pincodes sp JOIN pincodes p ON p.ID = sp.PincodeID WHERE p.Pincode = :pincode AND sp.IsActive = 1 LIMIT 1`
- If no row → refuse with the same 422 message as unserviceable pincode: `"We don't deliver to <pincode> yet."`
- If found → pass `storeID` to `orderService.writeOrder`; it inserts into `orders.StoreID`.

No change to price, tax, delivery charge, cart ownership, replay protection, or COD logic.

---

### API

All new routes require the standard `requireAdmin` + `requirePermission` gate.

#### Store tree and pincode management

| Method | Path | Permission | What |
|--------|------|-----------|------|
| GET | `/scope/tree` | `delivery` view | Full tree: groups (with children) + top-level stores + each store's active pincode count |
| POST | `/scope/groups` | `delivery` edit | Create group `{ name, parentId? }` |
| PUT | `/scope/groups/:id` | `delivery` edit | Rename or reparent `{ name?, parentId? }` |
| DELETE | `/scope/groups/:id` | `delivery` delete | Refused if has children or stores |
| PUT | `/scope/stores/:storeId/group` | `delivery` edit | Move store into a group `{ groupId }` or top-level `{ groupId: null }` |
| GET | `/scope/stores/:storeId/pincodes` | `delivery` view | Pincodes linked to this store (active + inactive) |
| POST | `/scope/stores/:storeId/pincodes` | `delivery` edit | Link a pincode `{ pincodeId }` — refused if another store already has it active |
| DELETE | `/scope/stores/:storeId/pincodes/:linkId` | `delivery` edit | Deactivate the link (sets `IsActive=0`) |

#### Staff scope management

| Method | Path | Permission | What |
|--------|------|-----------|------|
| GET | `/scope/staff/:adminId` | `access` view | Current scope nodes for this staff member |
| PUT | `/scope/staff/:adminId` | `access` edit | Replace scope nodes `{ nodes: [{type,id},...] }` — empty array = company-wide; refused if any node is outside the caller's own scope |

#### Scoped data (existing routes, new filter)

Existing routes gain a server-side scope filter transparently — the portal sends the same request, the server narrows it:

| Route | Scope applied |
|-------|--------------|
| GET `/orders` | `WHERE StoreID IN (…scope…)` |
| GET `/orders/:id` | `AND StoreID IN (…scope…)` or 403 |
| GET `/delivery/pincodes` (staff list) | `WHERE store_pincodes.StoreID IN (…scope…)` |
| GET `/customers` | `WHERE user placed an order at StoreID IN (…scope…)` |

---

### Portal screens

All new screens live under the **Delivery Pincodes** tab (which the user already owns for `delivery` module).

#### A. Store & Group Tree (new panel inside Delivery Pincodes tab)

```
[ + New Group ]  [ breadcrumb: Company / Zone-North / Area-A ]

▼ Zone-North                             [Rename] [Move] [Delete]
    ▼ Area-A                             [Rename] [Move] [Delete]
        📦 Store: TechXpert Andheri      [Move store] [View pincodes →]
        📦 Store: TechXpert Bandra       [Move store] [View pincodes →]
    ▼ Area-B                             [Rename] [Move] [Delete]
        📦 Store: TechXpert Thane        [Move store] [View pincodes →]
▼ Zone-South                             [Rename] [Move] [Delete]
    📦 Store: TechXpert Pune             [Move store] [View pincodes →]
📦 TechXpert Nagpur  (top-level)         [Move store] [View pincodes →]
```

- Tree fetched from `GET /scope/tree`.
- Clicking **View pincodes →** opens the pincode panel for that store (below).
- Create/rename/reparent inline modal; move uses a dropdown of groups.
- Delete shows a confirmation; server refuses if occupied.

#### B. Store Pincodes panel (per store, slide-in or sub-page)

```
Store: TechXpert Andheri
Active pincodes served: 12     [ + Link pincode ]

Pincode    Area        Status    Linked       Action
400053     Andheri W   ● Active  2024-01-10   [Unlink]
400054     Andheri E   ● Active  2024-01-10   [Unlink]
400058     Versova     ○ Inactive 2024-02-01  [Re-link]
```

- Pincode autocomplete from `/delivery/pincodes/search?q=` (existing, returns `pincodes` rows).
- **Link**: refused if another active store already owns it — server returns a 409 with the store name; portal shows "400053 is already served by TechXpert Bandra. Unlink it there first."
- **Unlink**: sets `IsActive=0`; the pincode is now unowned and can be linked elsewhere.

#### C. Staff Scope (inside Roles & Access tab, per staff member row)

Existing staff row in **Roles & Access → Staff** gains a **Scope** column:

```
Name            Role         Scope                        Action
Ravi Kumar      Merchandiser Zone-North, Area-B           [Edit scope]
Priya Sharma    Store Admin  Company-wide                 [Edit scope]
```

**Edit scope** modal:
```
Assign scope for Ravi Kumar (Merchandiser)
○ Company-wide (sees all stores)
● Select nodes:
  ☑ Zone-North
  ☐ Zone-South
    ☑ Area-B  (child of Zone-South)

[ Save ]  [ Cancel ]
```

Rules enforced in UI and server:
- You can only assign nodes that are within your own scope.
- Selecting a parent auto-suggests removing its children (they'd be redundant).
- Super admin has no scope panel (always company-wide).

---

### Proof criteria (local, before merge)

| Check | Pass when |
|-------|-----------|
| Create group "Zone-North", child "Area-A", move Store 1 into it | Tree shows correct nesting |
| Link pincode 400053 to Store 1 | `store_pincodes` row created, active |
| Try to link 400053 to Store 2 | Server returns 409, portal shows store name |
| Place an order via the phone app with pincode 400053 | `orders.StoreID = 1` |
| Place order with an unlinked pincode | 422 "We don't deliver to … yet." |
| Assign Merchandiser scope = Zone-North | `portal_staff_scope` has one group row |
| Sign in as Merchandiser → Orders tab | Only orders with StoreID in Zone-North stores |
| Super admin → Orders tab | All orders (no scope filter) |
| Store Admin with company-wide scope → Orders tab | All orders |
| Assign scope node outside your own | Server returns 403 |
| Delete non-empty group | Server returns 409 |
| `npm test` in server/ | All 56 tests (unchanged) + any new utils tests pass |

---

### Files touched by the build

| Layer | File | Change |
|-------|------|--------|
| SQL | `server/sql/portal_scope.sql` | new — creates `store_groups`, `store_group_stores`, `store_pincodes`, `portal_staff_scope`; ALTERs `orders` |
| Server util | `server/src/utils/scopeResolution.ts` | `storeIDsForAdmin`, `descendantStores` |
| Server service | `server/src/services/scopeService.ts` | tree CRUD, pincode linking, staff scope CRUD |
| Server route | `server/src/routes/scope.ts` | all `/scope/*` endpoints |
| Server service | `server/src/services/cartCheckoutService.ts` | resolve store from pincode, write `StoreID` |
| Server service | `server/src/services/orderService.ts` | `getOrders` / `getOrder` gain scope filter param |
| Server service | `server/src/services/deliveryAreaService.ts` | staff pincode list gains scope filter |
| Server route | `server/src/routes/orders.ts` | pass scope to `orderService` |
| Server route | `server/src/routes/delivery.ts` | pass scope to `deliveryAreaService` (staff list) |
| Web | `web/src/services/scope.ts` | API calls for tree and staff scope |
| Web | `web/src/components/StoreTreeManager.tsx` | screen A (tree) |
| Web | `web/src/components/StorePincodePanel.tsx` | screen B (pincode panel) |
| Web | `web/src/components/AccessManager.tsx` | add scope column + edit modal (screen C) |
| Web | `web/src/App.tsx` | wire new Scope route inside Delivery tab |

---

### Production rollout order

1. Run `server/sql/portal_scope.sql` (safe to run on an idle DB; the `ALTER TABLE orders` is additive).
2. Restart the API.
3. In the portal: link pincodes to stores before enabling A2 scope for any staff member — otherwise scoped staff will see zero orders.
4. Assign staff scope as needed.

---

## A3 — Store-owned staff accounts

### Why

Roles & Access lists every row of `homecare.admin_users`, and any active Homecare login can sign in to the store portal. Those logins were made for Homecare: lead managers, ticketing agents, and state managers. `portal_access.sql` also copied store roles from Homecare roles: Admin became Store Admin, and test-up and test-mumbai became Merchandiser.

Decided 23 Oct 2026:

- The store keeps its own staff list.
- Only people on that list appear in the portal or can sign in to it.
- The copied roles are removed.
- Homecare is not changed.
- Someone who works in both Homecare and the store is **linked**: they sign in to the store with their Homecare login, so they keep one password.
- Store-only staff get a store login.
- The portal reads `homecare.admin_users` only for linked people, never to list Homecare staff, and it never writes there.

### Decisions

| Question | Answer |
|---|---|
| Staff table | `techxpertstore.portal_staff`, one row per person who may use the portal. Its IDs start at 1001 so they never look like the old Homecare admin IDs already stored in `CreatedBy` / `UpdatedBy`. |
| Two kinds of staff | **Store login**: own email and password in `portal_staff`. **Linked**: `HomecareAdminID` points at a Homecare login; name, email and password come live from Homecare. Each row is exactly one kind. |
| Homecare logins | Can't sign in and don't appear unless someone links them. Unlinked Homecare people are never listed or searchable. |
| Linking | Needs Access **edit**. You type the person's exact Homecare email. The portal says only "found: <name>" or "no active Homecare login with that email", then you confirm. Their store role and places are set in Roles & Access as for anyone else. |
| Linked sign-in | Store email lookup first: a store login with that email wins. Otherwise the Homecare login with that email is checked, using its password and `is_active`, and must be linked and active in `portal_staff`. |
| Leaving | Deactivating a linked person in Homecare also blocks the store, on their next request. Deactivating them in the store removes only store access; Homecare is untouched. |
| Linked passwords | Changed or reset in Homecare only. The store's Reset password and Change password are for store logins; linked people see "Your password is managed in Homecare". A Homecare password change doesn't end store sessions already open; they end within 7 days (the token lifetime) or on Homecare deactivation. |
| Email clashes | A store login can't use an email that a linked person has, and a Homecare login can't be linked if a store login already uses its email. |
| First super admin | `IsSuperAdmin` flag on a staff row, of either kind. Created once with `npm run staff:bootstrap`, which either asks for name, email and password in the terminal (the password is never logged) or links a Homecare login by email. Homecare's own `super_admin` role no longer gives anything in the store. The portal UI cannot make super admins in A3. |
| Local dev seed | `ALLOW_DEV_ADMIN=1` with `admin@techxpert.in` / `admin123` keeps working locally as a super admin with id 1. Never in production. |
| Sessions | Tokens carry `staffId` plus audience `store-portal`. Tokens with only `adminId` are refused: old store sessions, and Homecare tokens if the JWT secret is ever shared. Everyone signs in once more after the switch. |
| Adding a store login | Needs Access **edit**. The adder enters name and work email. The portal generates a 12-character temporary password, shown once with Copy. The person must change it at first sign-in. No email is sent (out of scope). |
| Reset password | Store logins only. Access **edit**. Same flow: a new temporary password is shown once. The person's current sessions end, because tokens issued before `PasswordChangedAt` are refused. |
| Deactivate / reactivate | Access **delete**. You can't deactivate yourself or a super admin. The person is refused on their next request. Nothing is deleted, and the audit history keeps their name. |
| Own password | Anyone with a store login can use **Change password** (current, then new; at least 10 characters). |
| Hierarchy | Same rules as A1 and A2: you can only add, link, reset or deactivate someone whose role and places are within yours. |
| Existing copied roles | Removed: the `portal_staff_roles` and `portal_staff_scope` rows for Homecare ids 2, 3 and 4. The two copy `INSERT`s are dropped from `portal_access.sql`. |

### Table and migration (`server/sql/portal_staff.sql`)

```sql
CREATE TABLE techxpertstore.portal_staff (
  ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  HomecareAdminID INT NULL,               -- linked: homecare.admin_users.admin_id (no FK, other schema)
  Name VARCHAR(120) NULL,                 -- store login only; linked reads Homecare live
  Email VARCHAR(190) NULL,                -- store login only; stored lower-case
  PasswordHash VARCHAR(100) NULL,         -- store login only; bcrypt
  IsSuperAdmin TINYINT(1) NOT NULL DEFAULT 0,
  IsActive TINYINT(1) NOT NULL DEFAULT 1,
  MustChangePassword TINYINT(1) NOT NULL DEFAULT 0,
  PasswordChangedAt TIMESTAMP NULL,
  LastLoginAt TIMESTAMP NULL,
  CreatedBy INT NULL, CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedBy INT NULL, UpdatedAt TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_portal_staff_email (Email),
  UNIQUE KEY uq_portal_staff_homecare (HomecareAdminID),
  CONSTRAINT chk_portal_staff_kind CHECK (
    (HomecareAdminID IS NULL AND Name IS NOT NULL AND Email IS NOT NULL AND PasswordHash IS NOT NULL)
    OR (HomecareAdminID IS NOT NULL AND Email IS NULL AND PasswordHash IS NULL)
  )
) AUTO_INCREMENT = 1001;
```

The migration then:

1. Deletes every `portal_staff_scope` and `portal_staff_roles` row. They all point at Homecare admin IDs.
2. Renames `AdminID` to `StaffID` in both tables.
3. Adds foreign keys to `portal_staff (ID)`.

It never writes to `homecare`. Nobody is linked automatically; links are made on purpose in Roles & Access, or by `staff:bootstrap`.

### API

| Endpoint | Change |
|---|---|
| `POST /auth/admin/login` | Store login first, then a linked Homecare login (see Linked sign-in). The response adds `mustChangePassword` and `kind` (`store` or `linked`). |
| `GET /auth/admin/me` | Reads `portal_staff`; for linked people also checks the Homecare login is still active. |
| `POST /auth/admin/password` | New. `{ current, next }` for yourself; store logins only. Clears `MustChangePassword`. |
| `GET /access/staff` | `portal_staff` only, with each linked person's name and email read from Homecare. Each row has `kind`. |
| `POST /access/staff` | New. `{ name, email }` returns `{ staff, temporaryPassword }`. Needs Access edit. |
| `GET /access/staff/homecare-match?email=` | New. Exact email only. Returns `{ name }` for an active, not-yet-linked Homecare login, otherwise 404. Needs Access edit. |
| `POST /access/staff/link` | New. `{ email }` links that Homecare login. Needs Access edit. |
| `PATCH /access/staff/:id` | New. `{ name?, active? }`. Changing the name needs edit (store logins only); deactivating needs delete. |
| `POST /access/staff/:id/reset-password` | New. Returns `{ temporaryPassword }`. Store logins only. Needs Access edit. |
| Role and places endpoints | Unchanged, except that ids are now `portal_staff` ids. |

### Portal

- **Roles & Access, Staff panel:**
  - **Add staff** offers two choices:
    - **New store login**: a name + email form, then the temporary-password dialog shows the password once, with Copy.
    - **Link a Homecare login**: type the exact email, see "Found: <name>", then confirm.
  - Linked rows carry a "Homecare login" badge.
  - Each row adds **Deactivate** (confirm dialog); inactive rows get **Reactivate**.
  - Store-login rows also get **Reset password**.
  - The "Staff logins come from the shared admin accounts" text goes.
- **First sign-in:** when `mustChangePassword` is set, a Change password screen appears before the portal.
- **Sidebar footer:** a Change password entry.

### Phases

| Phase | What | Check |
|---|---|---|
| **S1** | SQL migration, bootstrap script, auth and access services on `portal_staff`, linking, new endpoints, server tests | Server tsc and tests. Scripted checks: an unlinked Homecare login is refused, a linked one signs in with its Homecare password, a store login works, a linked person deactivated in either place is refused, and an old `adminId` token is refused. |
| **S2** | Portal: Staff panel actions (new login, link, reset, deactivate), temporary-password dialog, first-sign-in and Change password screens | Web tsc, oxlint, browser check: add, link, sign in both ways, forced change, reset, deactivate |
| **S3** | Docs (`DATABASE_SCHEMA`, `ARCHITECTURE`, `WEB_SPEC`, this file) and rollout notes | Docs match the code |

### As built (S1, 23 Oct 2026)

The server is on `develop`. The portal still uses the A2 screens until S2, so it can't yet add or link staff, and it has no Change password screen.

**Files:**
- `server/sql/portal_staff.sql` is the migration.
- `server/src/scripts/staffBootstrap.ts` is `npm run staff:bootstrap`.
- `server/src/utils/staffAccounts.ts` holds the pure rules, with tests.
- `server/src/services/staffService.ts` handles sign-in, the per-request check and account changes.
- `server/src/services/accessService.ts` handles the staff actions and the hierarchy.
- `server/src/middleware/auth.ts` and `server/src/routes/{auth,access}.ts` are the routes and session checks.
- `authService.ts` is now customer sign-in only.

**Where the build is more precise than the plan:**
- **Super admins:** only a super admin can rename, reset or deactivate another super admin. Nobody can change themselves through the staff endpoints. They use Change password instead.
- **Temporary passwords:** while `MustChangePassword` is set, every admin endpoint except `GET /auth/admin/me` and `POST /auth/admin/password` answers 403 with `details.code = PASSWORD_CHANGE_REQUIRED`.
- **Changing your own password:** it returns a fresh token and cookie, so the person stays signed in while their other sessions end. It has its own rate limit of 10 per 15 minutes per person.
- **`PasswordChangedAt`:** written and compared in whole seconds from the API's clock, so a clock difference with MySQL can't end or keep sessions by mistake.
- **Session-check failures:** if the database can't be reached during the per-request check, the answer is 503 "Can't check your session right now", not 401. The portal therefore doesn't sign people out during an outage.
- **Failed sign-in:** an unlinked Homecare login with the right password gets a message saying it isn't set up for the store. A wrong password, or an email nobody has, gets the same "Invalid email or password".
- **Adding a store login:** an email that belongs to any Homecare login is refused, with "Link it instead". That way the person keeps one password.
- **Dev seed:** id 1, only with `ALLOW_DEV_ADMIN=1`, and only when no store row already has that email.
- **Audit entries:** Added Staff, Linked Homecare Login, Renamed Staff, Deactivated / Reactivated Staff, Reset Staff Password and Changed Own Password.

**Proof (local DB):**
- Server tsc is clean and 84 tests pass. They include the token rules: tokens with only `adminId`, Homecare tokens and customer tokens are refused.
- A 37-step HTTP script passed, covering:
  - an empty list after the migration;
  - an unlinked Homecare login refused;
  - adding a store login, with duplicate and Homecare-email refusals;
  - the forced change, the blocked endpoints and the old token refused;
  - assigning a role;
  - reset and deactivation ending sessions, then reactivation;
  - homecare-match returning found, 404 and already-linked;
  - linking, double-link refused, and reset or rename of a linked person refused;
  - a linked wrong password refused;
  - the audit entries.
- Service-level checks:
  - a linked person whose Homecare login is off is refused;
  - a linked person switched off in the store is refused;
  - the dev seed is refused without `ALLOW_DEV_ADMIN`.
- **Not yet proven:**
  - a linked sign-in with the correct Homecare password, because no test password is known and Homecare is never written. This is to be checked in S2 with a real login.
  - an old `adminId` token against the live API, which is covered by unit tests only.

### Production rollout order

1. Run `server/sql/portal_staff.sql`.
2. Run `npm run staff:bootstrap` on the server to create the real super admin: a new store login, or a link to that person's Homecare login.
3. Restart the API. Everyone signs in again.
4. The super admin adds store-only staff, links people who work in both, and gives each a role and places.

