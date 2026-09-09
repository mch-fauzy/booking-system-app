# Project Rules (Trial Booking System)

These project rules are authoritative for this codebase and take precedence over more general
conventions on conflict (specific > general). They are ported from `job-application-tracker` and
trimmed to a **4-hour take-home**: the same architecture, fewer moving parts.

- **Structure & conventions** → [architecture.md](./architecture.md) — Feature-Based ("Pattern B"),
  import boundaries, server/client boundary, folder-based naming, enforcement.
- **Server & data** → [server.md](./server.md) — Hono API, Drizzle + Neon, the confirm transaction,
  the DTO pattern, error mapping, migrations.
- **Client & UI** → [client.md](./client.md) — RSC reads, the two client forms, fetch + Zod, shadcn.
- **Domain + API contract** → [domain.md](./domain.md) — data model, statuses, invariants, the
  last-seat race strategy, the `/api/v1` surface, check placement, seed cases.

## Where each concern lives

| Concern | Source of truth |
|---------|-----------------|
| **Structure, boundaries, naming, enforcement** | **[architecture.md](./architecture.md)** |
| **Hono API, Drizzle, transactions, DTOs, error mapping** | **[server.md](./server.md)** |
| **RSC/client split, forms, shadcn** | **[client.md](./client.md)** |
| **Invariants, statuses, race handling, endpoints, seed** | **[domain.md](./domain.md)** |

Cross-cutting standards: workflow order Research → Plan → **TDD** → Code Review → Commit; **≥80%
coverage**; immutability + small focused files; validate inputs at every boundary; no secrets in code.

## Locked technical choices

Do not silently change; flag if a task requires deviating.

| Area | Choice |
|------|--------|
| App shape | **One unified Next.js (App Router) app** (no separate FE/BE) |
| Package manager | **npm** |
| UI | React + **shadcn/ui** + Tailwind; **react-hook-form** + Zod for the two forms |
| API | **Hono** mounted in-app (`app/api/[[...route]]/route.ts`, `hono/vercel`, Node runtime) |
| ORM / DB | **Drizzle** + **Neon Postgres** — `drizzle-orm/neon-serverless` (WebSocket `Pool`; transactions + `FOR NO KEY UPDATE` row lock) |
| Validation | **Zod 4** at every boundary (request DTOs + client forms) |
| Wire format | URI-versioned `/api/v1/...`; **camelCase end-to-end** (DB columns snake_case) |
| Auth | **None** — parent is chosen from a dropdown; admin roster is unprotected (documented cut) |
| Client data | **No TanStack Query** — RSC reads via services; forms `fetch` the API then `router.push` |
| Tests | **Vitest 5** (`unit` hermetic, `integration` against Neon) + React Testing Library |
| Deploy | **One Vercel app** + **Neon**; migrations in `vercel.json` `buildCommand` |
