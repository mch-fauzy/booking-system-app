# Ottodot Trial Booking

The smallest working slice of a trial-class booking system that stays correct under edge cases:
a parent picks a child and a trial class, books, pays (mock), and sees the booking status; an admin
sees each class roster. Trial classes are capped at **4 confirmed students**.

Built as one Next.js (App Router) app with a Hono API mounted in-process, Drizzle ORM and Neon
Postgres. The interesting part is the confirm transaction — see
[The last-seat race](#the-last-seat-race).

**Live demo:** <https://booking-system-app-alpha.vercel.app>

Seeded with the data in [Seed data](#seed-data). Pay with `4242 4242 4242 4242` to succeed, or any
number ending in `0000` (e.g. `4000 0000 0000 0000`) to force a decline. To see the last-seat race,
open "Math – Fractions" (1 seat left) in two tabs, book Leo Tan in one and Sofia Lim in the other,
then pay both: the first is confirmed, the second gets a 409 and is never charged.

## Run it

Requires **Node ≥ 22.12** (developed on 22.14) and a Neon Postgres database (free tier is enough).

```bash
cp .env.example .env      # then fill in the two connection strings
npm install
npm run db:migrate        # create the schema
npm run db:seed           # synthetic data (see Seed data below)
npm run dev               # http://localhost:3000
```

`.env` needs two URLs from the same Neon project:

| Variable | Which URL | Used by |
|---|---|---|
| `DATABASE_URL` | **pooled** (host contains `-pooler`) | the app, the seed script and integration tests |
| `DATABASE_URL_UNPOOLED` | direct (no `-pooler`) | migrations (`drizzle-kit`) |

### Commands

| Command | What it does |
|---|---|
| `npm run test` | unit tests — hermetic, no database |
| `npm run test:integration` | integration tests against real Neon (includes the race test) |
| `npm run test:coverage` | all tests with the 80% v8 threshold |
| `npm run lint` | ESLint: import boundaries, folder structure, conventions |
| `npm run knip` | unused files / exports / dependencies |
| `npm run check:exports` | fails on exports only used inside their own file |
| `npm run build` | production build |

Husky pre-commit runs `lint && knip && check:exports && test`.

## What I built

Five flows, four pages, five endpoints.

| Flow | Where |
|---|---|
| Pick a child and an available class | `/` |
| Submit a trial booking | `POST /api/v1/bookings` |
| Mock payment, result recorded | `POST /api/v1/bookings/:id/payments` |
| Booking status after submission | `/bookings/[id]` |
| Admin roster per class | `/admin`, `GET /api/v1/trial-classes/:id/roster` |

```
GET  /api/v1/trial-classes             # all classes with capacity, confirmedCount, seatsLeft
GET  /api/v1/trial-classes/:id/roster  # confirmed bookings: student, parent, confirmedAt
POST /api/v1/bookings                  # 201 pending_payment | 409 duplicate (+ existingBookingId) | 404
GET  /api/v1/bookings/:id              # booking + student + class + payment attempts
POST /api/v1/bookings/:id/payments     # 201 booking (confirmed | payment_failed) | 409 full / duplicate / not payable
```

Responses use one envelope: `{ message, data }` on success, `{ message, error?, errors?, data? }` on
error. Parents and their children are read directly by the Server Component that renders the booking
form, so they need no HTTP endpoint.

**Mock payment:** a card number ending in `0000` is declined, anything else succeeds. Only
`card_last4` is stored — never a full card number.

## Time spent

**About ~3.5 hours in total**.

| Phase | Time |
|---|---|
| Planning: data model, invariants, race strategy | ~30m |
| Scaffold, tooling, enforcement, shared infrastructure | ~40m |
| Schema, statuses, migration, DB backstop | ~25m |
| Trial-class feature (list with seats left, roster) | ~25m |
| Booking create/read, confirm transaction, invariant tests | ~30m |
| Seed data | ~10m |
| UI: two forms, four pages, component tests | ~20m |
| README, AI_USAGE | ~15m |

Backend correctness took the largest share by design; the UI is deliberately plain.

## Backend design

### Data model

Five tables. Every table has `id` (uuid), `created_at`, `updated_at`.

| Table | Columns beyond the base | Notes |
|---|---|---|
| `parents` | `name`, `email` | seed only, no auth |
| `students` | `parent_id` → parents, `name` | a child belongs to one parent |
| `trial_classes` | `subject`, `starts_at`, `capacity` (default 4) | **the row that gets locked** |
| `bookings` | `student_id`, `trial_class_id`, `status`, `cancellation_reason` | partial unique index (below) |
| `payment_attempts` | `booking_id`, `status`, `card_last4` | append-only; one row per attempt |

Design choices worth calling out:

- **`capacity` lives on the class row** (default 4), so the cap is data, not a magic number in code.
- **No `seats_taken` counter.** The confirmed count is derived from `bookings` under the lock, so
  there is no denormalised value that can drift.
- **`cancellation_reason`** (`class_full` | `duplicate`) records *why* a booking was cancelled, so a
  future parent-initiated cancel does not overload the status.
- **A partial unique index** is the database backstop for duplicates:
  ```sql
  CREATE UNIQUE INDEX bookings_one_confirmed_per_student_class
    ON bookings (student_id, trial_class_id) WHERE status = 'confirmed';
  ```
  It permits many cancelled or failed rows for the same pair, but only one `confirmed`.
- Statuses are `text` columns validated by a Zod enum, not `pgEnum` — adding a status is a code
  change, not a migration.

### Booking statuses

| Status | Meaning |
|---|---|
| `pending_payment` | created; **holds no seat** |
| `confirmed` | charged and seat claimed under the class row lock |
| `payment_failed` | charge declined; retryable |
| `cancelled` | terminal; see `cancellation_reason` |

| From → To | Trigger |
|---|---|
| — → `pending_payment` | `POST /bookings` |
| `pending_payment` / `payment_failed` → `confirmed` | payment succeeded and a seat was free |
| `pending_payment` / `payment_failed` → `payment_failed` | charge declined (seat was free; nothing claimed) |
| `pending_payment` / `payment_failed` → `cancelled` | class full or child already confirmed — **never charged** |
| `confirmed` / `cancelled` → anything | 409, terminal in this MVP |

**A pending booking holds no seat.** Seats exist only as `confirmed` rows. This keeps the model small
and makes the race a single locked count. The tradeoff is exactly the scenario in the brief: a parent
can reach the payment page and still lose the seat — handled with a clear 409 and no charge.

### How duplicates are prevented

Three layers, deliberately:

1. **On create** — a child with a live booking (`pending_payment`, `payment_failed` or `confirmed`)
   for that class gets a **409** carrying `data.existingBookingId`, so the UI links to it instead of
   creating a second pending row.
2. **At confirm, under the lock** — re-checked inside the transaction, because the first check is not
   protected against concurrency. If the child is already confirmed, the booking is cancelled with
   `duplicate` and never charged.
3. **In the database** — the partial unique index. It holds even if a code path skips the service (a
   script, a second endpoint, a bug). `app.onError` maps its `23505` to the same **409**, so a
   backstop hit is never a 500.

### How payment failure is handled

The seat is checked **before** the charge, so nobody pays for a seat that is gone. On a decline the
attempt is written as `failed`, the booking becomes `payment_failed`, and **nothing** is added to the
roster — every roster and count query filters `status = 'confirmed'`. The parent can retry on the
same booking, which appends a second `payment_attempts` row; the history is preserved.

## The last-seat race

### Approach

One transaction that **locks the trial class row first**, then counts, then charges:

```ts
db.transaction(async (tx) => {
  const booking = await bookingRepo.findById(id, tx);              // 404 if missing
  if (!isPayable(booking.status)) throw new ConflictException(…);  // 409 not payable

  await trialClassRepo.lockForConfirm(booking.trialClassId, tx);   // SELECT … FOR NO KEY UPDATE

  if (alreadyConfirmed) { cancel(DUPLICATE); return 'duplicate'; }
  if (confirmedCount >= trialClass.capacity) {
    cancel(CLASS_FULL); return 'class_full';                       // never charged
  }

  const charge = chargeMock(input.cardNumber);                     // seat check happened first
  await paymentAttemptRepo.create({ … }, tx);
  await bookingRepo.update(id, { status: confirmed | payment_failed }, tx);
}, { isolationLevel: 'read committed' });
```

Walking the brief's scenario:

1. A selects the last seat → `pending_payment`. No seat held.
2. B selects the same seat → `pending_payment` too. Both allowed.
3. B pays → locks the class row, sees 3 < 4, charges, confirms. Commit releases the lock.
4. A pays → **blocks on the lock** until B commits, then sees 4 ≥ 4 → **409 "Trial class is full"**,
   booking `cancelled` with `class_full`, **no payment attempt row**.

Ordering is decided by Postgres row locking, not by application timing, so it holds across multiple
serverless instances.

Two details that make it work:

- **`FOR NO KEY UPDATE`, not `FOR UPDATE`.** Inserting a booking takes a `FOR KEY SHARE` lock on the
  referenced class row (the foreign-key check). `FOR UPDATE` conflicts with that, so one parent
  paying would block every other parent from even *creating* a pending booking for that class — an
  operation that claims no seat. `FOR NO KEY UPDATE` permits the FK check while still conflicting
  with itself, so confirmations serialise and bystanders are not blocked. Measured locally: a
  competing insert completed in 1307 ms under `FOR NO KEY UPDATE` while the payer still held the
  lock, versus 3856 ms under `FOR UPDATE` — it had to wait for release.
- **`READ COMMITTED` is pinned explicitly.** Each statement re-snapshots, so A's count *after* the
  lock wait sees B's committed row. Under `REPEATABLE READ` the same locking read aborts with
  `40001` and every caller would need a retry loop.

### Why this approach

It is the simplest thing that is correct under concurrency. No retry loops (which `SERIALIZABLE`/SSI
would require), no expiry job (which a seat-hold model would require), and it works across multiple
serverless instances because the database decides the order, not the application.

### Tradeoffs I accepted

1. **The lock is held across the charge.** Fine here because the mock charge is an in-process pure
   function costing microseconds. With a real payment provider I would not hold a row lock across a
   network call — I would hold the seat instead (`pending` with a TTL plus an expiry job), or
   confirm-then-refund.
2. **Capacity has no plain database constraint.** It is a count across rows, not a value on one row,
   so no `CHECK` or unique index can express it — the row lock *is* the guarantee. A trigger is the
   documented next step. Duplicates, which *can* be expressed, do have an index.
3. **A hot class serialises confirmations.** Irrelevant at capacity 4; it would matter at scale.
4. **A parent can reach checkout and lose the seat.** Direct consequence of "pending holds no seat" —
   the alternative is holding seats, which needs expiry handling. Handled with a clear 409 and no charge.

## Which checks live where

| Check | UI | Backend (service) | Database | Background job |
|---|---|---|---|---|
| Valid ids and shapes | form validation (same Zod schema) | `validate()` → 422 | FK constraints | — |
| Child belongs to parent | child list filtered by parent | 404 if student unknown | FK | — |
| Class full | "Full" badge, disabled — a hint only | count under the lock → 409 | — (the lock) | — |
| Duplicate child + class | — | live booking → 409; re-checked under the lock | partial unique index → 409 | — |
| Payment declined | inline error, retry link | `payment_failed`, never confirms | attempt row persisted | — |
| Last-seat race | — | serialised by `FOR NO KEY UPDATE` | row lock | — |
| Stale `pending_payment` rows | — | — | — | **not needed** — pending holds no seat |

The UI may hide or disable a full class for a better experience, but it is never the authority: the
backend validates every operation and can reject it.

## Verification

| Layer | What it covers |
|---|---|
| Unit (`npm run test`) | DTO schemas and mappers, status helpers, `chargeMock`, error-envelope mapping including `23505 → 409`, both forms, status and roster components |
| Integration (`npm run test:integration`) | one test per invariant, plus the full HTTP surface through Hono |

The four invariants each have a test in
`src/features/booking/services/booking.integration.test.ts`:

| Invariant | Test |
|---|---|
| ≤ 4 confirmed per class | the 5th confirmation is rejected, cancelled `class_full`, never charged |
| One confirmed per (child, class) | a second confirm is rejected and cancelled `duplicate` |
| Failed payment never confirms | attempt recorded, roster count unchanged, retry then succeeds |
| **Last-seat race** | two concurrent `pay()` calls on a class with 3 confirmed → **exactly one** confirmed, one 409 |

The race test issues two real concurrent transactions on separate pool connections, so it exercises
the lock rather than simulating it. `src/shared/db/schema.integration.test.ts` additionally proves the
partial unique index rejects a direct insert that bypasses the service entirely.

Coverage is ~94% statements / ~92% branches against an 80% threshold.

## Seed data

`npm run db:seed` truncates all five tables and re-seeds **through the real service path**, so every row gets its
status from the same code the app runs. Three parents, five children, three classes:

| Class | State | Covers |
|---|---|---|
| Science – Volcanoes | 1 confirmed, 1 `payment_failed` | available seats + **payment failure** |
| Math – Fractions | **exactly 3 confirmed** → 1 seat left | the **last-seat race** demo |
| Science – Space | 4 confirmed | a **full** class, shown disabled |

Booking Zara Rahman into Volcanoes again reproduces the **duplicate** 409. Leo Tan and Sofia Lim are
free for Fractions, so the race can be demonstrated live from two browser tabs.

## Assumptions

- **No authentication.** The parent is chosen from a dropdown and `/admin` is unprotected. Auth is
  orthogonal to the invariants being tested and would have consumed the timebox.
- **The payment provider is in-process and deterministic** (card ending `0000` declines), so the demo,
  seed and tests can force both outcomes without a network call.
- A pending booking holds no seat.
- One display locale and time zone (`en-SG` / `Asia/Singapore`) for every rendered date, so server and
  client render identically and never mismatch on hydration.
- Trial booking only — no regular enrollment, per the brief.

## What I deliberately cut

- Authentication, authorisation, and an admin login
- Parent-initiated cancellation (statuses are terminal in this MVP)
- Real payments, idempotency keys on the payment endpoint, and any money/amount on the model
- A pending-booking expiry job — unnecessary while pending holds no seat
- A database-level capacity trigger (the row lock is the guarantee; the trigger is a next step)
- Pagination — a class list and a roster of ≤ 4 are tiny
- Client-side data fetching (TanStack Query): every read is a Server Component calling a service
- Email confirmations, timezone selection, and frontend polish

## What I would monitor after release

- **409 rate on `POST /bookings/:id/payments`** — parents reaching checkout and losing the seat. A
  rising rate is a UX signal that seats should be held rather than claimed at confirmation.
- **Lock wait time on `trial_classes`** — the direct measure of confirmation contention.
- **Ratio of `payment_failed` to `confirmed`** — payment health.
- **Any `23505` reaching `app.onError`** — the DB backstop firing means a code path bypassed the
  service. Should be zero; if it is not, that is a bug worth paging on.
- Booking creation latency, to catch lock contention leaking into unrelated operations.

## What I would do next

1. **Hold the seat instead of claiming it at confirmation** once a real payment provider is involved:
   `pending` with a TTL plus an expiry job, so the lock is never held across a network call.
2. **Idempotency keys** on the payment endpoint, so a retried request cannot double-charge.
3. **A capacity trigger** in the database, closing the one invariant with no DB-level backstop.
4. **Authentication** — real parent accounts and an admin role for the roster.
5. **Parent-initiated cancellation**, which frees a seat and makes `cancellation_reason` earn its keep.
6. **Live seat counts** on the booking page (polling or websockets), which is where TanStack Query
   would finally be worth adding.
