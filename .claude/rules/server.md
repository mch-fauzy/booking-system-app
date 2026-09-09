# Server & Data — Hono API + Drizzle + Neon

> The server half of the unified app. Layering inside each feature:
> **`api/` (Hono router) → `services/` (business rules + transactions) → `repositories/` (Drizzle)**,
> with `dtos/` defining typed input and return shapes. All files here are **`server-only`**.

## Hono API (mounted in Next.js)

- **Mount** at `src/app/api/[[...route]]/route.ts` via `hono/vercel`:

  ```ts
  // app/api/[[...route]]/route.ts
  import { handle } from 'hono/vercel';
  import { app, v1 } from '@/shared/lib/api/api';
  import { bookingRouter } from '@/features/booking/api/v1/booking';
  import { trialClassRouter } from '@/features/trial-class/api/v1/trial-class';
  export const runtime = 'nodejs';                // NOT edge — neon-serverless needs Node
  v1.route('/bookings', bookingRouter);
  v1.route('/trial-classes', trialClassRouter);
  app.route('/v1', v1);                           // mounted HERE, after all features register
  export const GET = handle(app);
  export const POST = handle(app);
  ```

- **Root app + versioning:** `shared/lib/api/api.ts` exports `app = new Hono().basePath('/api')` and a
  bare `v1 = new Hono()`. Feature routers are standalone `new Hono()` instances; mounting happens only
  in `route.ts` so `shared/` never imports `features/`. No CORS (same-origin).
- **Validation:** a shared `validate(target, schema)` helper in `shared/lib/validation/` wraps
  `@hono/zod-validator` and throws `ValidationException` (422) with `{ path, messages }[]`. Read typed
  input via `c.req.valid('json' | 'param' | 'query')`.
- **Errors:** services throw `HTTPException` (or `ValidationException`); `app.onError` maps them to
  the `ApiError` envelope. `app.notFound` for unknown routes. **Error mapping table:**

  | Thrown | Status |
  |---|---|
  | `ValidationException` (Zod) | **422** `{ message, errors: [{ path, messages }] }` |
  | `HTTPException(404)` — unknown booking / class / student | **404** |
  | `ConflictException(message, data?)` — class full, duplicate booking (carries `{ existingBookingId }`), booking not payable | **409** `{ message, error, data? }` |
  | Postgres `23505` unique_violation (the partial unique index backstop) | **409** with the generic `Conflict()` message — `isUniqueViolation()` checks `err.code` and `err.cause.code`; never 500 |
  | anything else | **500**, message suppressed in production via `errorDetail` |

- **Messages:** `message` strings come from `shared/constants/messages.ts` factories
  (`SuccessMessageConstant.EntityCreated('Booking')`, `ErrorMessageConstant.DataEntityNotFound(…)`,
  `Conflict()`, plus domain ones: `ClassFull()`, `DuplicateBooking()`, `BookingNotPayable()`).
- **Route params:** every `/:id` uses the shared `idParamSchema` (`shared/dtos/id-param.ts`).
- **REST:** a payment is a created sub-resource — `POST /bookings/:id/payments` returns **201** for both
  a succeeded and a declined attempt (the attempt row exists either way); the body is the booking.
- **Logger:** `app.use(logger())` registered first.

## DTO pattern (defined params + return)

- **Request DTO** — `features/<d>/dtos/v1/requests/<name>.ts`: Zod schema + inferred type. Used by
  `validate()` on the server **and** by the client form resolver. Single source of truth for input.
- **Response DTO** — `features/<d>/dtos/v1/responses/<name>.ts`: Zod response schema + inferred type
  + a **mapper** (`mapBooking(row) => BookingResponse`) from the Drizzle row. The mapper controls which
  fields are exposed. Keep the schema file free of `server-only` so the client can parse with it.
- The **same response DTO is the contract for both data paths**: the router returns it inside the
  envelope; an RSC page calling the service gets the bare DTO.

## Response envelope

```ts
// shared/types/response.ts (plain, client-shareable)
interface ApiResponse<T> { message: string; data: T }
interface ApiError { message: string; error?: string | null; errors?: unknown; data?: unknown }
```

`ok(data, message)` in `shared/utils/response/` builds success responses. **No pagination in the
MVP** (a class list and a roster of ≤4 are tiny) — no cursor helper, no `paginated()`; add when a list
can grow.

## Drizzle + Neon

- **Driver: `drizzle-orm/neon-serverless` (WebSocket `Pool`).** `neon-http` has **no interactive
  transactions**, and the confirm step needs `SELECT … FOR NO KEY UPDATE` inside one, so it is not an option.

  ```ts
  // shared/lib/db/db.ts (server-only)
  import 'server-only';
  import { Pool, neonConfig } from '@neondatabase/serverless';
  import { drizzle } from 'drizzle-orm/neon-serverless';
  import ws from 'ws';
  import { config } from '@/shared/config';
  import * as schema from '@/shared/db/schema';
  neonConfig.webSocketConstructor = ws;
  const pool = new Pool({ connectionString: config.database.url, max: 5 }); // POOLED url; max ≥ 2 for the race test
  export const db = drizzle({ client: pool, schema }); // schema incl. relations → db.query.* nested reads
  export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
  ```

- **Two connection strings:** `DATABASE_URL` = **pooled** (`-pooler`) for app queries, the seed script
  and integration tests; `DATABASE_URL_UNPOOLED` for migrations only (`drizzle.config.ts` reads it
  directly — `shared/config.ts` does not parse it).
- **Config:** `shared/config.ts` (server-only) parses `process.env` once with Zod and fails fast.
- **Repositories** wrap Drizzle queries and accept an optional `tx` (`DbTransaction`) so they run inside
  a transaction. No business logic in repositories. Nested reads (booking → student/class/attempts,
  parent → students) use the `db.query.*` relational API with `relations` from the schema; aggregates
  (confirmed count) use the select builder. Row types come from `$inferSelect`, never hand-written.
- **The lock lives in one place:** `features/booking/repositories/trial-class.ts`
  (`bookingTrialClassRepo.lockForConfirm`). `features/trial-class` only reads. The same repo's
  `findById` is a plain unlocked existence check — only `lockForConfirm` takes a row lock, and its
  `tx` parameter is required so it cannot be called outside a transaction.
- **Columns:** `text` for strings (length validated in Zod), `timestamptz` via `baseColumns`,
  `uuid().defaultRandom()` PKs, `integer` for `capacity`, status as `text` + Zod enum (no `pgEnum`).

## The confirm transaction (the core invariant)

Every write that touches a seat runs inside one `db.transaction()` that **locks the class row first**
with **`FOR NO KEY UPDATE`** (`.for('no key update')`). It serializes confirmations for that class
without blocking FK inserts of new pending bookings (which only take `KEY SHARE`; `FOR UPDATE` would
block them). Everything after the lock sees a consistent count.

```ts
// features/booking/services/booking.ts (server-only) — shape
type PayOutcome = 'confirmed' | 'payment_failed' | 'class_full' | 'duplicate';

async function payInTransaction(id, input): Promise<PayOutcome> {
  return db.transaction(async (tx) => {
    const booking = await bookingRepo.findById(id, tx);                         // 404 if missing
    if (!isPayable(booking.status)) throw new ConflictException(BookingNotPayable());
    const trialClass = await bookingTrialClassRepo.lockForConfirm(booking.trialClassId, tx); // FOR NO KEY UPDATE
    if (await bookingRepo.hasConfirmedForStudentClass(booking.studentId, trialClass.id, tx)) {
      await bookingRepo.update(id, { status: CANCELLED, cancellationReason: DUPLICATE }, tx);
      return 'duplicate';
    }
    if ((await bookingRepo.countConfirmed(trialClass.id, tx)) >= trialClass.capacity) {
      await bookingRepo.update(id, { status: CANCELLED, cancellationReason: CLASS_FULL }, tx); // never charged
      return 'class_full';
    }
    const charge = chargeMock(input.cardNumber);                                // in-process, deterministic
    await paymentAttemptRepo.create({ bookingId: id, ...charge }, tx);
    await bookingRepo.update(id, { status: charge.status === FAILED ? PAYMENT_FAILED : CONFIRMED }, tx); // 23505 → 409
    return charge.status === FAILED ? 'payment_failed' : 'confirmed';
  }, { isolationLevel: 'read committed' });
}
// pay(): run payInTransaction, then throw ConflictException for class_full / duplicate AFTER commit.
```

- Throwing inside the callback rolls the transaction back, so the deliberate `cancelled` write on
  class-full / duplicate is **returned** as an outcome and the 409 is thrown by `pay()` after the
  transaction commits.
- **Isolation is pinned to `read committed`** (Postgres' default, stated explicitly because the
  invariant depends on it). Each statement re-snapshots, so the count taken *after* the lock wait sees
  the winner's committed row. Under `repeatable read` the same locking read aborts with `40001` and
  every caller would need a retry loop — that is the optimistic strategy we deliberately avoided.
- **Seat check before the charge**, so a parent is never charged for a seat that is gone. The mock
  charge is in-process, so holding the row lock across it costs microseconds. **Tradeoff to document
  in the README:** with a real payment provider you would not hold a DB lock across a network call —
  you would hold the seat (`pending` with a TTL) or confirm-then-refund.

## Migrations

- Schema discovered by `drizzle.config.ts` (`./src/shared/db/schema.ts`); output to
  `src/shared/db/migrations`.
- `npm run db:generate -- --name <snake_case>` then `npm run db:migrate` (**never `push` in prod**).
  A descriptive `--name` is **required** (`scripts/db-generate.mjs`).
- The **partial unique index** (`CREATE UNIQUE INDEX … ON bookings (student_id, trial_class_id) WHERE
  status = 'confirmed'`) is declared in `schema.ts` via `uniqueIndex(...).on(...).where(sql\`…\`)` so
  `db:generate` emits it; fall back to `db:generate:custom` only if the generated SQL lacks the `WHERE`.
- Vercel runs `db:migrate` in `vercel.json` `buildCommand` against `DATABASE_URL_UNPOOLED`.

## Tests (server side)

- **`unit` project** (hermetic, pre-commit gated): DTO schemas, mappers, constants, pure utils,
  `chargeMock`, `app.onError` mapping (including `23505 → 409`).
- **`integration` project** (real Neon, `*.integration.test.ts`): one test per invariant —
  capacity (5th confirm → 409), duplicate (same child+class twice → 409, and the raw index rejects a
  direct insert), payment failure (roster count unchanged, `payment_failed` recorded), and the
  **last-seat race** (`Promise.all` of two `payBooking` calls on a class with 3 confirmed → exactly
  one `confirmed`, one 409). Use the `withRollback(tx)` helper (`shared/lib/db/with-rollback.ts` — it
  imports the `db` singleton, so it is a `lib/` module, not a `utils/` one) where a test does not need
  concurrency; the race test must commit (two real connections) and clean up after itself.
- **Fixture setup is idempotent.** A test that commits real rows calls `resetFixture()`
  (`shared/lib/db/reset-fixture.ts`) at the START of `beforeAll` as well as in `afterAll`, because
  `afterAll` never runs if the process is killed mid-file — leaving fixture rows visible in the app.
  It matches only that fixture's parent email and class subject, so seeded demo data is untouched.
- **Test-infra layout:** only the root `tests/` folder is for test scaffolding (currently the
  `server-only` stub). Helpers that application code's own layering already places — like
  `withRollback` — live in their concern folder under `src/`, never in a parallel `src/**/test/` tree.
