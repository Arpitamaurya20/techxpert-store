# Techxpert Store 🏗️

Techxpert Store is an e-commerce platform tailored for homeowners and contractors buying construction and home materials in India. It pairs a high-performance customer mobile application with a web-based management portal, dynamic CMS-driven storefront sections, and an enterprise SQL relational data model.

---

## 📁 Repository Structure

```text
techxpert-store/
├── app/                  # Customer Mobile App (React Native + Expo)
├── web/                  # Web Application & Admin Management Portal
├── docs/                 # Central Project Documentation
│   ├── SRS.md            # Software Requirements Specification
│   ├── DATABASE_SCHEMA.md# MySQL 8.0 Relational Data Model
│   ├── ARCHITECTURE.md   # High-level System Architecture & Monorepo Topology
│   └── WEB_SPEC.md       # Web Application Specifications & Merchandising Portal
├── README.md             # Project Overview & Quick Start (this file)
└── .gitignore            # Root-level ignore configuration
```

---

## 📚 Central Documentation

All cross-cutting specifications and architectural blueprints reside in the [`docs/`](./docs) directory:

- 📋 [**Software Requirements Specification (SRS)**](./docs/SRS.md) — Comprehensive requirements covering customer mobile workflows, CMS merchandising, bulk pricing models, and acceptance criteria.
- 🗄️ [**Database Schema Proposal**](./docs/DATABASE_SCHEMA.md) — Relational MySQL 8.0 schema detailing categories, products, bulk price tiers, inventory movements, carts, orders, and CMS banners.
- 🏛️ [**System Architecture**](./docs/ARCHITECTURE.md) — System boundaries, client-backend interaction, and source-of-truth principles.
- 🌐 [**Web Portal Specification**](./docs/WEB_SPEC.md) — Features, banner lifecycles, and user experience specifications for the web platform.

---

## 🚀 Getting Started

### 📱 Customer Mobile App (`app/`)

The mobile client is built using React Native, Expo Router, and TypeScript.

```bash
cd app
npm install
npx expo start
```

*For more details on mobile architecture and guidelines, see [`app/AGENTS.md`](./app/AGENTS.md).*

---

### 🔌 Backend API Service (`server/`)

The Node.js + Express backend service running on port 5001, providing catalog, auth, order, and CMS APIs for both the mobile app and management portal.

```bash
cd server
npm install
npm run dev     # Starts server on http://localhost:5001
```

- Health & API Manifest: `http://localhost:5001/health`
- Catalog Categories: `http://localhost:5001/catalog/categories`
- Catalog Products: `http://localhost:5001/catalog/products`
- Auth Login: `POST http://localhost:5001/auth/login`
- Customer Orders: `http://localhost:5001/orders`

---

### 💻 Web Management Portal (`web/`)

The web client provides real-time administrative control over inventory, orders, wholesale bulk pricing tiers, and banners.

```bash
cd web
npm install
npm run dev     # Starts portal on http://localhost:5173
```

---

## 🛠️ Development Principles

1. **Backend as Source of Truth**: Pricing, bulk discounts, delivery location eligibility, and stock reservations are computed and validated on the backend.
2. **Unified Documentation**: Cross-platform changes must be kept in sync under [`docs/`](./docs).
3. **Safe Publishing**: Content updates (banners, hero sections) support drafts, schedules, and live previews before being published to mobile customers.
