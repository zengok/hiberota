# Hibe Rota Production Readiness Plan

This document records the current analysis and the safe migration path for turning Hibe Rota into a production-ready public grants portal without breaking existing public behavior.

## Current Findings

- `src/main.jsx` is still a large SPA entry file. It should be split gradually into pages, layout, call components, services, hooks, and shared utilities.
- `server/index.mjs` combines HTTP setup, API routes, scraping, normalization, exports, cache, and shutdown behavior. It should be split only after behavior-preserving service boundaries exist.
- SQLite currently stores automation state as `state_kv` plus call payloads. This is compatible with the current app, but needs queryable columns and incremental writes.
- Scraping and public API still share one Node.js process. The next step is to extract worker entrypoints while keeping the same adapter contracts.
- Public call browsing must stay no-login. Admin operations must stay separate and authenticated.
- Existing compatibility endpoints such as `/api/calls` must remain available while `/api/v1/*` evolves.

## Refactor Order

1. Data safety foundation:
   - Add a SQLite repository interface.
   - Add migrations and queryable call columns.
   - Keep the current state-loading contract intact.
   - Stop rewriting unchanged call rows on each save.
2. API extraction:
   - Introduce `server/app.mjs` and move route handlers behind controllers.
   - Keep `server/index.mjs` as a thin boot file.
   - Standardize v1 response envelopes and errors.
3. Worker separation:
   - Add an automation worker entrypoint.
   - Keep in-memory queue fallback for development.
   - Add Redis/BullMQ adapter behind an interface.
4. Runtime validation:
   - Add Zod env and request validation.
   - Add response validation in the frontend service layer.
5. Frontend decomposition:
   - Introduce React Router while preserving existing URLs.
   - Move pages and call UI out of `src/main.jsx` in small chunks.
6. CI, observability, and deployment:
   - Add GitHub Actions, Docker, readiness checks, metrics, and documentation.

## Guardrails

- Every phase must pass `npm test`, `npm run build`, and `npm audit --omit=dev`.
- Public routes and old API shapes must remain compatible.
- No user account/profile system should be introduced.
- Admin endpoints must never be reachable without authentication.
- Database changes must migrate existing local data automatically.
