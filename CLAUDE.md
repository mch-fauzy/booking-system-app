# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The **Ottodot Senior Full-Stack take-home**: the smallest working slice of a **trial-class booking
system** that stays correct under edge cases. Brief: `tmp/requirements.md` (local-only, not committed).
**Timebox: 4 hours of implementation.** Backend correctness, invariants, tests, and the README
explanation are graded; frontend polish is not.

Four invariants the code must hold (the `.claude/rules/domain.md` file is authoritative):

1. **Capacity** — never more than 4 `confirmed` bookings per trial class.
2. **No duplicates** — one `confirmed` booking per (student, trial class).
3. **Payment failure never confirms** — a failed payment leaves the roster untouched.
4. **Last-seat race** — two parents paying for the last seat: at most one ends up `confirmed`.

Deliverables the repo must contain when done: `README.md` (run steps, design section, race approach +
tradeoffs, time spent, cuts, monitoring, next steps), `AI_USAGE.md`, seed data, tests. Video is
recorded separately. **Trial booking only — no regular enrollment, no auth.**

## Architecture (one unified fullstack app)

A **single Next.js (App Router) app**, Feature-Based ("Pattern B"), Hono API mounted in-app, Drizzle +
Neon Postgres, deployed as one Vercel app. Structure and conventions are ported from
`job-application-tracker` and trimmed to the 4-hour scope.

| Rule file | Covers |
|------|--------|
| [`.claude/rules/architecture.md`](.claude/rules/architecture.md) | Feature-Based structure, import boundaries, server/client boundary, naming, enforcement |
| [`.claude/rules/server.md`](.claude/rules/server.md) | Hono API, Drizzle + Neon, the confirm transaction, DTOs, error mapping, migrations |
| [`.claude/rules/client.md`](.claude/rules/client.md) | RSC reads vs client forms, fetch + Zod, shadcn/Tailwind |
| [`.claude/rules/domain.md`](.claude/rules/domain.md) | Data model, statuses, invariants, race strategy, API surface, check placement, seed cases |

### The big picture that spans files

- **Two features, one schema.** `features/trial-class` (list classes with seats left, roster) and
  `features/booking` (choose child + class, submit, mock payment, status). Both read the `bookings`
  table, and features may not import each other, so **all Drizzle tables live in
  `shared/db/schema.ts`** (pure metadata, not `server-only`). Services and repositories stay per feature.
- **Two data paths, one contract.** Server Components call a feature **service directly** (in-process)
  for every read. Client Components exist only for the two forms (booking, payment) and call the
  **Hono API** via `fetch`. The **response DTO** is the shape both paths return.
- **Request lifecycle (server):** Hono router `/api/v1/...` → Zod request DTO → **service** (invariants,
  `db.transaction()`) → **repository** (Drizzle, accepts `tx`) → response DTO → `app.onError` maps
  thrown errors to the `ApiError` envelope.
- **The confirm transaction is the core guarantee.** `POST /bookings/:id/payments` runs one
  transaction: lock the class row (`SELECT … FOR NO KEY UPDATE`), count `confirmed`, reject with **409** if
  full, record the payment attempt, then confirm. A **pending booking holds no seat**; seats are
  claimed only at confirmation, under the lock. A partial unique index on
  `(student_id, trial_class_id) WHERE status = 'confirmed'` is the DB backstop for duplicates, and its
  `23505` violation is mapped to **409**, not 500. See `.claude/rules/domain.md`.

## Tech stack (locked)

| Area | Choice |
|------|--------|
| Framework | **Next.js** (App Router) + React + TypeScript, scaffolded with `create-next-app@latest` |
| UI | **shadcn/ui** + Tailwind; **react-hook-form** + `@hookform/resolvers/zod` for the two forms |
| API | **Hono** mounted at `app/api/[[...route]]/route.ts` (`hono/vercel`, `runtime = 'nodejs'`) |
| Data | **Drizzle ORM** + **Neon Postgres** via `drizzle-orm/neon-serverless` (WebSocket `Pool`; transactions + row locks) |
| Validation | **Zod 4** (`z.enum(OBJ)`, request DTOs via a shared `validate()` helper; client forms) |
| Tests | **Vitest 5** (`unit` + `integration` projects) + React Testing Library |
| Package manager | **npm** |
| Deploy | **One Vercel app** + **Neon** (`vercel.json` runs `db:migrate` before `next build`) |

**Deliberately not installed** (add only when a real need appears): TanStack Query (no client-side
reads in the MVP — RSC reads, forms `fetch` then `router.push`), dnd-kit, next-themes, sonner.

## Commands

> Script names mirror `job-application-tracker`. `db:generate` requires an explicit `--name`
> (`scripts/db-generate.mjs` blocks drizzle's random migration names).

```bash
npm run dev                  # next dev
npm run build                # next build
npm run lint                 # eslint (boundaries + folder-structure + conventions)
npm run knip                 # unused files/exports/deps
npm run test                 # vitest run --project unit (hermetic; pre-commit gated)
npm run test -- <file>       # single unit test file
npm run test:coverage        # unit tests with the 80% v8 threshold
npm run test:integration     # vitest run --project integration (real Neon; *.integration.test.ts — includes the race test)
npm run db:generate -- --name <snake_case>          # drizzle-kit generate
npm run db:generate:custom -- --name <snake_case>   # empty migration for hand-written SQL (partial unique index)
npm run db:migrate           # drizzle-kit migrate (DATABASE_URL_UNPOOLED)
npm run db:seed              # seed parents/students/classes/bookings through the service path
```

Env (`.env`, gitignored; `.env.example` committed): `DATABASE_URL` (**pooled** `-pooler` Neon URL — app,
seed and integration tests) and `DATABASE_URL_UNPOOLED` (migrations only; read by `drizzle.config.ts`).
`db:seed` runs `TRUNCATE … CASCADE` on all five tables first, so it is idempotent and destructive. Husky pre-commit runs
`lint && knip && test`.

## Gotchas

- **`neon-http` has no interactive transactions** — the confirm step needs a row lock inside a
  transaction, so the driver is `neon-serverless` with `neonConfig.webSocketConstructor = ws`. The
  Hono route handler must be `runtime = 'nodejs'` (edge is incompatible).
- **The race test needs ≥2 pool connections** (`Pool({ max: 5 })`) — two `payBooking` calls in
  `Promise.all` must actually run concurrently to prove the lock.
- **`server-only` boundary.** Services, repositories, routers, `shared/lib/db/db.ts`, and response
  mappers import `server-only`; `shared/db/schema.ts` does **not** (drizzle-kit imports it). Vitest
  aliases `server-only` to `tests/stubs/server-only.js`.
- **Vitest 5:** inline `projects` inherit root config (no `extends: true`); coverage `include`/`exclude`
  match relative to the project root; needs Node ≥ 22.12 (local: 22.14). Config is `vitest.config.mts`
  (`.ts` is loaded as CJS and warns). The **integration project sets `testTimeout`/`hookTimeout` to 60s**:
  a Neon round trip is ~290ms and the confirm transaction makes six, so DB tests blow the 5s default;
  a free-tier Neon cold start can slow a whole file ~40% and was seen tripping a 30s ceiling.
- **ESLint 9** (9.39.x, pinned by `create-next-app`). `eslint-plugin-boundaries` is **v7**, whose config
  differs from the v6 shape in `job-application-tracker`: `mode: 'full'` → `partialMatch: false`,
  `rules:` → `policies:`, and selectors wrap in `{ element: { type } }`. Using v6 shapes only warns, so
  check `npm run lint` output is silent, not just exit 0.
- **`shadcn init` mis-resolves a nested `utils` alias**: it emits `import { cn } from "cn"` and installs a
  bogus `cn` package. Rewrite those imports to `@/shared/utils/cn/cn` after `shadcn add`. The `shadcn`
  dependency itself is real — `globals.css` does `@import "shadcn/tailwind.css"` (knip can't see CSS
  imports, so it is in `ignoreDependencies`).
- **Next 16 owns `AGENTS.md`** and regenerates the `nextjs-agent-rules` block. Because `AGENTS.md` exists
  and hosts that block, the generator **skips `CLAUDE.md`** — delete `AGENTS.md` and the next `next dev`
  overwrites this file with `@AGENTS.md`.
- **camelCase on the wire, snake_case in the DB** (Drizzle column names). **Status is `text` + a Zod
  enum**, not `pgEnum`. **No TS `enum`** (lint error) — `as const` objects.
- **Folder-based naming, no type suffixes, no `index.ts` barrels, no `I` prefix.** Shared DTOs live in
  `shared/dtos/{requests,responses}/` — never `shared/schemas/`, which collides with `shared/db/schema.ts`.
- **Unused exports fail two checks.** `knip` (`rules.exports`/`types` = `error`) catches symbols nothing
  references; **`npm run check:exports`** catches symbols never *imported* elsewhere — knip's blind spot,
  since it counts a type as used when an exported signature mentions it. Drop the `export`; never add an
  ignore. Both run in pre-commit: `lint && knip && check:exports && test`.
- **Mock payment rule:** card number ending in `0000` fails, anything else succeeds. One form field.
- **Lock strength is `FOR NO KEY UPDATE`**, not `FOR UPDATE` — the latter blocks FK inserts of new
  pending bookings for the duration of a confirm.
- **Dates:** ISO on the wire, `formatDateTime()` (fixed locale + time zone) everywhere in the UI. No
  `toLocaleString()` in components (hydration mismatch).
- **Forms never call `fetch`** — `postJson()` in `shared/lib/api-client/` is the one HTTP path.

## Workflow & rules precedence

- Follow the workflow in order: Research & Reuse → Plan → **TDD** → Code Review → Commit. The ≥80%
  coverage bar and test-first discipline apply; the invariants above each get an integration test.
- **`.claude/rules/` files are authoritative** for structure, boundaries, and domain behavior; they
  override broader conventions on conflict.
- **Report mid-implementation decisions** before proceeding — never silently change scope. Anything
  cut for time goes into the README "what I deliberately cut / next steps" sections.
