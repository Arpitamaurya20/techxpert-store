# Techxpert Store — System Architecture

**Product:** Techxpert Store — Construction & Home Materials Commerce Platform  
**Target Market:** India (Homeowners & Contractors)  
**Last Updated:** October 2026  

---

## 1. Monorepo Organization

```
techxpert-store/
├── app/                  # Customer Mobile Application (Expo / React Native)
│   ├── src/              # Screens, components, services, state, assets
│   ├── app.json          # Expo configuration
│   └── package.json      # Mobile dependencies
├── web/                  # Web Application / Admin Portal
│   ├── index.html        # Entry HTML
│   └── ...               # Web application code & assets
├── docs/                 # Central Documentation Hub
│   ├── SRS.md            # Software Requirements Specification
│   ├── DATABASE_SCHEMA.md# Relational MySQL 8.0 schema proposal
│   ├── ARCHITECTURE.md   # Overall system architecture (this document)
│   └── WEB_SPEC.md       # Web frontend specifications & guidelines
├── README.md             # Repository entry point & developer setup
└── .gitignore            # Root-level ignore rules
```

---

## 2. Multi-Platform Topology

```
+------------------------------------+    +------------------------------------+
|         Customer Mobile App        |    |        Web Admin / Portal          |
|      (React Native / Expo SDK)     |    |           (Web Client)             |
+-----------------+------------------+    +-----------------+------------------+
                  |                                         |
                  | REST / JSON                             | REST / JSON
                  v                                         v
+------------------------------------------------------------------------------+
|                             Backend API Service                              |
|                          (Node.js + Express / REST)                          |
+------------------------------------------------------------------------------+
                  |                                         |
                  | SQL                                     | S3 / CDN
                  v                                         v
+------------------------------------+    +------------------------------------+
|          MySQL 8.0 Database        |    |       Media / Object Storage       |
|  Catalogue, Orders, Carts, CMS     |    |   Banners, Product Images, Icons   |
+------------------------------------+    +------------------------------------+
```

---

## 3. Component Responsibilities

### 3.1 Customer Mobile App (`app/`)
- Built with **Expo** (React Native) + **TypeScript**.
- Mobile-first catalog browsing, delivery location selection, cart management, bulk pricing tiers, and Order Again rails.
- Dynamic CMS-driven homepage layout rendering banner carousels and promotional sections without requiring native store releases.

### 3.2 Web Application (`web/`)
- Admin and merchandising portal to configure homepage banners, hero carousels, section ordering, bulk discount rules, and catalog metadata.
- Built for desktop and responsive web browsers with rich interactivity, responsive tables, real-time preview, and role-based controls.
- Also capable of serving or linking customer web storefront features.

### 3.3 Backend & Database (`docs/DATABASE_SCHEMA.md`)
- Single source of truth for inventory, pricing, discount calculations, order processing, and authentication.
- Relational schema running on **MySQL 8.0 (InnoDB)** with strict transactional consistency and currency stored in `DECIMAL` / integer paise.

---

## 4. Documentation Guidelines
- **Cross-Platform Consistency**: Any API contract, pricing rule, or database model change must be reflected in `docs/SRS.md` and `docs/DATABASE_SCHEMA.md`.
- **Platform-Specific Specs**:
  - For mobile-specific architectural details, refer to [`app/AGENTS.md`](../app/AGENTS.md).
  - For web portal requirements, refer to [`docs/WEB_SPEC.md`](./WEB_SPEC.md).
