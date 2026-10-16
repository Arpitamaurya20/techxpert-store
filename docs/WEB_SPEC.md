# Techxpert Store — Web Application Specification

**Scope:** Web Application & Admin Merchandising Portal  
**Target:** Construction & Home Materials Commerce Platform  
**Reference:** [`docs/SRS.md`](./SRS.md) Section 8.10 & Section 9  

---

## 1. Overview & Objectives

The web workspace (`web/`) serves as the administrative and operational control center for Techxpert Store, enabling merchandising teams, category managers, and store admins to:
1. **Manage Banners & Hero Carousels**: Create, edit, schedule, preview, reorder, and publish campaign banners that reflect immediately in the mobile application.
2. **Configure Homepage Sections**: Dynamically arrange homepage sections (e.g., hero carousel, category shortcuts, trust strips, offer rails, product grids).
3. **Product & Bulk Pricing Management**: Oversee catalog items, pack sizes, bulk tier discounts, and stock levels.
4. **Order & Customer Overview**: Review recent orders, customer activity, and fulfillment statuses.
5. **Customer Web Storefront (Future / Extensible)**: Support desktop browsing for contractors and homeowners placing large material orders.

---

## 2. Core Functional Modules

### 2.1 Dashboard & Analytics Overview
- KPI cards: Active campaigns, live banners, pending orders, catalog item count.
- Recent activity timeline and audit log preview.

### 2.2 CMS & Banner Management
- **Lifecycle States**: `draft` -> `scheduled` -> `published` -> `paused` -> `archived`.
- **Form Controls**: Title, subtitle, CTA label, CTA type/route, image upload/URL preview, alt text, terms text, active date range picker.
- **Visual Preview**: Live interactive mobile and desktop banner preview showing exact visual presentation before publishing.
- **Section Ordering**: Drag-and-drop or rank-order selector for homepage layout blocks.

### 2.3 Catalog & Bulk Price Rules
- Category & product hierarchy manager.
- Bulk pricing tier editor: Minimum order quantities, percentage/fixed discounts, validity periods.
- Location availability toggles for regional warehouses.

### 2.4 Audit & Publishing History
- User identification, timestamps, and previous state snapshots.
- Single-click rollback for misconfigured campaigns.

---

## 3. Design & UX Principles
- **Theme**: Premium industrial & modern commerce aesthetic (Navy `#0f172a`, Construction Amber/Orange `#f97316`, Clean Slate `#f8fafc`).
- **Layout**: Collapsible sidebar navigation, high-density data tables, responsive modals, and real-time live preview panel.
- **Performance**: Instant filtering, search-as-you-type, optimistic UI updates, and zero layout shift.
