# Antigravity & Agent Guidelines — Techxpert Store

Welcome to the Techxpert Store repository. This repository is a monorepo consisting of a customer mobile application, a web application / admin portal, and central project documentation.

## Monorepo Layout

- `docs/`: Central project documentation ([`docs/SRS.md`](./docs/SRS.md), [`docs/DATABASE_SCHEMA.md`](./docs/DATABASE_SCHEMA.md), [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md), [`docs/APP_WORKFLOW.md`](./docs/APP_WORKFLOW.md), [`docs/WEB_SPEC.md`](./docs/WEB_SPEC.md)).
- `app/`: Customer Mobile Application (Expo / React Native / TypeScript).
  - When working inside `app/`, read and strictly follow [`app/AGENTS.md`](./app/AGENTS.md).
- `web/`: Web Application & Merchandising Portal.

## General Rules

1. **Documentation Integrity**: When implementing features or changing schemas/APIs, maintain documentation consistency across `docs/`.
2. **Do Not Trust Cached Assumptions**: Always inspect current file state and existing patterns before making changes.
3. **Commit Cleanliness**: Always review `git status` before committing and avoid checking in environment secrets or build artifacts.
