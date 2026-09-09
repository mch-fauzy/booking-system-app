# Architecture — Feature-Based, one unified Next.js app

> The enforceable structure for this **single fullstack Next.js (App Router) app** (Feature-Based,
> "Pattern B"): Next.js + Hono + Drizzle + shadcn/ui + Neon, deployed as one app on Vercel. There is
> no separate FE/BE. Ported from `job-application-tracker`; differences are marked **(booking)**.

## Folder structure

`features/` is organized by **domain**. Each feature is **flat** — no `server/` subfolder; the
server/client split is enforced by directives + `server-only`, not by folders.

```
src/
├── app/                              # routing/orchestration only (thin)
│   ├── api/[[...route]]/route.ts     # Hono mount (imports each feature router) — Next-mandated name
│   ├── page.tsx                      # RSC: booking form (parents/students/classes via services)
│   ├── bookings/[id]/page.tsx        # RSC: booking status
│   ├── bookings/[id]/pay/page.tsx    # RSC shell + client payment form
│   ├── admin/page.tsx                # RSC: classes + rosters
│   ├── layout.tsx  globals.css
├── features/<domain>/                # booking/, trial-class/
│   ├── api/v1/<d>.ts                 # server-only — Hono router, versioned by folder
│   ├── services/<d>.ts               # server-only — business rules + transactions
│   ├── repositories/<d>.ts           # server-only — Drizzle data access (accepts a tx)
│   ├── dtos/v1/requests/<name>.ts    # Zod input schema + inferred type
│   ├── dtos/v1/responses/<name>.ts   # Zod response schema + inferred type + mapper
│   ├── components/<name>.tsx         # 'use client' forms / RSC-safe presentational pieces
│   ├── hooks/use-<name>.ts           # 'use client' — form submit → fetch → /api/v1 (only if reused)
│   └── constants/  types/  utils/    # no feature-level lib/ (Bulletproof React — lib is shared-only)
└── shared/                           # importable by ANY feature or app
    ├── db/schema.ts                  # (booking) ALL Drizzle tables — NOT server-only (drizzle-kit imports it)
    ├── db/base-columns.ts  db/migrations/
    ├── components/ui/                # shadcn primitives
    ├── lib/<concern>/                # infra buckets: db/, api/, validation/, exceptions/
    ├── utils/<concern>/              # pure-helper buckets: response/, error-detail/, cn/
    ├── dtos/requests/  dtos/responses/   # shared DTOs (id-param, client-response) — un-versioned
    ├── config.ts  constants/  types/
```

> **Do not over-scaffold.** Create a subfolder only when its first file exists.
>
> **Exception — general-purpose utility buckets (`utils/` in either layer; `lib/` at `shared/` only):**
> named for a *file kind*, so each concern gets its **own subfolder** from the start
> (`shared/lib/db/db.ts`, `shared/utils/response/response.ts`). The file is named for the concern
> (folder-based naming, **no `index.ts` barrels**) and its test colocates inside. **Single-role
> folders** (`services/`, `repositories/`, `api/`, `components/`, `hooks/`, `dtos/.../requests|responses/`)
> and **small peer collections** (`constants/`, `types/`) stay flat. `shared/dtos/` splits into
> `requests/` + `responses/` like a feature's, but is **un-versioned** — it holds cross-cutting shapes
> (`id-param`, `client-response`), not a feature's API surface. Never call it `schemas/`: that reads as
> the Drizzle schema in `shared/db/schema.ts`.

**(booking) Why the schema is in `shared/db/`:** `bookings` is read by both features (availability
count in `trial-class`, create/pay in `booking`), and features may not import each other. The rule
"used by 2+ features → lift to `shared/`" applies; tables are pure metadata with no domain logic, so
nothing leaks. Services and repositories remain per feature.

### `lib/` vs `utils/` — which bucket?

**The discriminator is the import set**, not "generic vs app-specific":

| Bucket | Holds | Examples |
|---|---|---|
| **`utils/`** | **Pure helper functions** whose imports are *only* language built-ins, `@/shared/types`/`constants`, or other utils — **no** `server-only`, `@/shared/lib/**`, or framework/infra packages. | `utils/response/` (envelope builders), `utils/error-detail/`, `utils/cn/` |
| **`lib/`** | Modules that **import infrastructure or a framework** (`server-only`, Neon/Drizzle, Hono, `ws`), hold state/singletons, or have side effects. | `lib/db/`, `lib/api/`, `lib/validation/`, `lib/exceptions/` |

**`lib/` is shared-only.** Enforcement: ESLint `no-restricted-imports` forbids any `**/utils/**` file
from importing `server-only` or `@/shared/lib/**`. The finer call is review-backed.

## Import boundaries (the rules that matter)

Unidirectional flow — **`shared → features → app`**:

| Rule | Enforced by |
|------|-------------|
| `shared/` importable by anything | OK |
| A feature imports `shared/` + **its own** files only — **no cross-feature imports** | ESLint `eslint-plugin-boundaries` (error) |
| `app/` composes features; nothing imports `app/` | OK |
| Used by 2+ features → lift to `shared/` (this is why `schema.ts` is shared) | convention |

Within a feature: `shared/db/schema → repositories → services → (api router | RSC page)`;
`components → fetch → api` (client forms). Components never call services directly in client code.

## Server/client boundary

- **Runtime server logic** (`api/` routers, `services/`, `repositories/`, response **mappers**,
  `shared/lib/db/db.ts`, `shared/config.ts`) begins with **`import 'server-only'`** → importing it from
  a `'use client'` file is a **build error**.
- **Exception — Drizzle schema/metadata files** (`shared/db/schema.ts`, `shared/db/base-columns.ts`)
  are **NOT** `server-only`: drizzle-kit imports them directly and `server-only` throws outside an RSC
  bundler. They are pure table-shape metadata (no connection string, no queries). Vitest aliases
  `server-only` to an empty stub (`tests/stubs/server-only.js`) so node-env tests can import `db.ts`.
- `'use client'` components reach the server only via `fetch` to the Hono API. Zod **schemas**
  (request + response) are plain and shareable by both sides.
- **Server Components** (`page.tsx`) call a feature **service directly** (`await`). All reads in the
  MVP are RSC reads; the only client components are the booking form and the payment form.

## File naming — folder-based, NO type suffix

Role comes from the **folder**; the file is named for the **domain/concern**.

| Concern | File |
|---|---|
| Hono router | `features/<d>/api/v1/<d>.ts` |
| Service | `features/<d>/services/<d>.ts` |
| Repository | `features/<d>/repositories/<d>.ts` |
| Request DTO | `features/<d>/dtos/v1/requests/<name>.ts` |
| Response DTO | `features/<d>/dtos/v1/responses/<name>.ts` |
| Drizzle tables | `shared/db/schema.ts` **(booking — shared, one file)** |
| Component | `features/<d>/components/<name>.tsx` (kebab file, `PascalCase` export) |
| Hook | `features/<d>/hooks/use-<name>.ts` (`use-` is React-mandated) |
| Types / Constants | `features/<d>/{types,constants}/<name>.ts` (flat) |
| Utils | `features/<d>/utils/<concern>/<concern>.ts` · `shared/utils/<concern>/…` |
| Lib (shared only) | `shared/lib/<concern>/<concern>.ts` |

- **No `.service.ts` / `.repository.ts` / `.controller.ts` / `.dto.ts` suffixes** — the folder is the marker.
- **No `I` prefix** on interfaces. `interface` for object shapes, `type` for unions. Avoid `any`.
- **Enum-like constants — no TS `enum`** (ESLint `no-restricted-syntax`). Use an `as const` object
  with a **CONSTANT_CASE singular** name, **UPPER_CASE keys**, lowercase wire/DB values, and a derived
  union `type X = (typeof OBJ)[keyof typeof OBJ]`. Validate at the boundary with `z.enum(OBJ)` (Zod 4).
- **Don't export what's only used in its own file.** Enforced by two complementary checks in
  pre-commit: **`knip`** (`exports`/`types` = `error`) catches symbols nothing references, and
  **`npm run check:exports`** (`.claude/local-checks/no-internal-exports.mjs`) catches symbols never
  *imported* by another file. The second exists because knip counts a type as used when an exported
  signature mentions it (`findById(): Promise<TrialClassRow>`), so in-file-only exports pass it.
  Fix a hit by dropping the `export` — never by adding an ignore.
- **API versioning is folder-based:** `api/v1/<d>.ts` + `dtos/v1/{requests,responses}/`; `services/`,
  `repositories/`, `db/` stay un-versioned.

## Shared base columns (used by ALL tables)

Drizzle has no entity inheritance, so define **`baseColumns`** in `shared/db/base-columns.ts` and
spread it into every table. **(booking)** Trimmed — no actor columns (no auth, no audit log) and no
soft delete:

```ts
// shared/db/base-columns.ts (NOT server-only - pure metadata, imported by drizzle-kit)
export const baseColumns = {
  id: uuid('id').defaultRandom().primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .defaultNow().notNull().$onUpdate(() => new Date()),
};
```

## Enforcement (violations error, not just documented)

Port `eslint.config.mjs`, `folder-structure.mjs`, `knip.json`, `.husky/pre-commit`, and
`scripts/db-generate.mjs` from `job-application-tracker` at scaffold time, adjusting the
folder-structure rule for `shared/db/schema.ts`.

| Concern | Tool |
|---|---|
| Import boundaries (no cross-feature, `shared→features→app`) | ESLint **`eslint-plugin-boundaries`** at **error** |
| Runtime server/client boundary | **`server-only`** package |
| Folder structure + naming + colocation | **`eslint-plugin-project-structure`** (`lib/` + `utils/` allow only concern subfolders) |
| `utils/` purity | **ESLint `no-restricted-imports`** scoped to `**/utils/**` (`server-only`, `@/shared/lib/**`) |
| TS `enum` | **ESLint `no-restricted-syntax`** — `TSEnumDeclaration` errors |
| Unused exports / files / deps | **`knip`** with `rules.exports`/`rules.types` = **`error`** (entry: `src/app/**/{page,layout,not-found,error}.tsx`, `src/app/**/route.ts`, `scripts/seed.ts`; ignore `shared/components/ui/**`) |
| Exports used only in their own file | **`npm run check:exports`** — `.claude/local-checks/no-internal-exports.mjs` (knip's blind spot; not audited: `app/`, `components/ui/`, `db/schema.ts`) |
| Coverage | Vitest v8 thresholds 80% (`unit` project); exclude `shared/components/ui/**`, `app/**/page.tsx`, `app/layout.tsx` |

Run lint + `knip` + unit tests in a **husky pre-commit** hook so violations fail for humans and
Claude Code alike.
