# Domain — Trial Booking (capacity, duplicates, payment, last-seat race)

> Authoritative for the data model, statuses, invariants, the race strategy, the `/api/v1` contract,
> where each check lives, and the seed cases. Structure → [architecture.md](./architecture.md);
> Hono/Drizzle/transaction → [server.md](./server.md); pages/forms → [client.md](./client.md).

## The product (one job)

A parent picks one of their children and an available **trial class**, submits a booking, pays (mock),
and sees the booking status. An admin sees each class's **roster**. Trial classes are **capped at 4
confirmed students**. **Trial booking only** — no regular enrollment, no auth (parent chosen from a
dropdown; admin page unprotected — both documented cuts).

## Invariants (each gets an integration test)

| # | Invariant | Primary guard (app) | Backstop (DB) |
|---|---|---|---|
| 1 | ≤ 4 `confirmed` per class | count under `FOR NO KEY UPDATE` lock on the class row → **409** | none expressible as a plain constraint; the lock *is* the guarantee (a trigger is a documented next step) |
| 2 | one `confirmed` per (student, class) | check for existing `confirmed`/`pending_payment` on create → **409**; re-checked under the lock at confirm | **partial unique index** `(student_id, trial_class_id) WHERE status = 'confirmed'`; `23505` → **409** |
| 3 | failed payment never confirms | attempt recorded as `failed`, booking → `payment_failed`, roster query counts only `confirmed` | roster/count queries filter `status = 'confirmed'` |
| 4 | last seat: at most one winner | both confirms serialize on the class row lock; second sees count = 4 → **409**, booking → `cancelled`, never charged | same index as #2 for the duplicate variant of the race |

**Why both levels.** The app check runs inside the lock, so it is the one that fires in practice and
returns a clean **409** with a domain message. The DB index is defense in depth: it holds even if a
future code path skips the service (a script, a second endpoint, a bug), and `app.onError` translates
its `23505` into the same **409**, so a backstop hit is never a 500. Capacity has no equivalent plain
constraint (it is a count, not a row), which is exactly why the row lock is the strategy.

## Data model (`shared/db/schema.ts`, all tables spread `baseColumns`)

| Table | Columns (beyond `id`, `createdAt`, `updatedAt`) | Notes |
|---|---|---|
| `parents` | `name` text, `email` text | seed only |
| `students` | `parentId` uuid FK, `name` text | a child belongs to one parent |
| `trial_classes` | `subject` text, `startsAt` timestamptz, `capacity` integer default 4 | the row that gets locked |
| `bookings` | `studentId` FK, `trialClassId` FK, `status` text, `cancellationReason` text null | partial unique index on `(studentId, trialClassId) WHERE status = 'confirmed'`; index `(trialClassId, status)` |
| `payment_attempts` | `bookingId` FK, `status` text (`succeeded` / `failed`), `cardLast4` text | append-only history; one row per attempt |

- `status` columns are `text` + Zod enum (no `pgEnum`). `capacity` lives on the class row (default 4)
  so the invariant is data, not a magic number.
- `cancellationReason` (`class_full` | `duplicate`, null otherwise) says *why* a booking is `cancelled`,
  so a future parent-initiated cancel does not overload the status.
- Status constants live in `shared/constants/booking-status.ts` because `shared/db/schema.ts` types its
  columns with them (shared may not import features). Drizzle `relations` are declared in the schema so
  nested reads use `db.query` instead of hand-written joins.
- No `seats_taken` counter: the count is derived from `bookings` under the lock (no drift to manage).
- No soft delete, no actor columns (no auth), no audit log — YAGNI for 4 hours.

## Statuses

```ts
// shared/constants/booking-status.ts (shared/ because shared/db/schema.ts types its columns with these)
export const BOOKING_STATUS = {
  PENDING_PAYMENT: 'pending_payment',  // created, no seat held
  CONFIRMED: 'confirmed',              // payment succeeded AND seat claimed under the lock
  PAYMENT_FAILED: 'payment_failed',    // charge declined; retryable
  CANCELLED: 'cancelled',              // terminal; see cancellationReason
} as const;
export const PAYMENT_STATUS = { SUCCEEDED: 'succeeded', FAILED: 'failed' } as const;
export const CANCELLATION_REASON = { CLASS_FULL: 'class_full', DUPLICATE: 'duplicate' } as const;
// plus z.enum(...) schemas per constant, LIVE_STATUSES, and isPayable()
```

| From → To | Trigger |
|---|---|
| — → `pending_payment` | `POST /bookings` |
| `pending_payment` / `payment_failed` → `confirmed` | payment succeeded, seat available |
| `pending_payment` / `payment_failed` → `payment_failed` | payment declined (seat was available; nothing claimed) |
| `pending_payment` / `payment_failed` → `cancelled` | class full (`class_full`) or child already confirmed via another booking (`duplicate`) at confirm time — never charged |
| `confirmed` / `cancelled` → anything | **409** — terminal in the MVP (no cancel-by-parent endpoint; documented cut) |

**A pending booking holds no seat.** Seats exist only as `confirmed` rows. This keeps the model tiny
and makes the race resolution a single locked count; the tradeoff (a parent can reach the payment
page and lose the seat) is exactly the scenario the brief describes and is handled with a clear 409.

## The last-seat race (README centerpiece)

1. A selects the last seat → `POST /bookings` → `pending_payment` (no seat held).
2. B selects the same seat → `pending_payment` too. Both allowed.
3. B pays → transaction: lock class row → confirmed = 3 < 4 → charge → `confirmed`. Commit releases the lock.
4. A pays → transaction blocks on the lock until B commits → confirmed = 4 → **409 "class is full"**,
   booking → `cancelled` (`class_full`), **no charge**.

Ordering is decided by Postgres row locking, not by application timing, so it holds across multiple
serverless instances. Lock strength is **`FOR NO KEY UPDATE`**: it serializes confirmations but does not
block `INSERT INTO bookings` (an FK insert only takes `KEY SHARE`), so new pending bookings never queue
behind a confirm. `FOR UPDATE` would. **Tradeoffs accepted:** the lock is held across the (in-process, deterministic)
mock charge — with a real PSP you would hold the seat instead (`pending` with TTL + expiry job) or
confirm-then-refund; a hot class serializes confirmations (fine at capacity 4).

## Mock payment

`chargeMock(cardNumber)` — pure function in `features/booking/utils/charge-mock/`: card number ending
in `0000` → `{ status: 'failed', cardLast4 }`, otherwise `succeeded`. Deterministic so the demo, seed,
and tests can force both paths. The form has one field (card number); only `cardLast4` is persisted.

## API surface (`/api/v1`, camelCase wire, Zod DTOs, `{ message, data }` envelope)

```
GET    /trial-classes                 # all classes with capacity, confirmedCount, seatsLeft
GET    /trial-classes/:id/roster      # confirmed bookings: student, parent, confirmedAt  (admin)
POST   /bookings                      # { studentId, trialClassId } → 201 pending_payment | 409 duplicate (+ existingBookingId) | 404
GET    /bookings/:id                  # booking + student + trial class + payment attempts
POST   /bookings/:id/payments         # { cardNumber } → 201 booking (confirmed | payment_failed) | 409 full / duplicate / not payable
```

Parents + students for the booking form are read in the Server Component via the service (no HTTP
endpoint — nothing on the client needs it).

| DTO | Shape |
|---|---|
| `createBookingRequest` | `{ studentId: uuid, trialClassId: uuid }` |
| `payBookingRequest` | `{ cardNumber: /^\d{12,19}$/ }` (spaces stripped) |
| `bookingResponse` | `{ id, status, cancellationReason, student: { id, name }, trialClass: { id, subject, startsAt }, paymentAttempts: [{ id, status, cardLast4, createdAt }], createdAt, updatedAt }` |
| `trialClassResponse` | `{ id, subject, startsAt, capacity, confirmedCount, seatsLeft }` |
| `rosterResponse` | `{ trialClass, entries: [{ bookingId, student: { id, name }, parent: { id, name }, confirmedAt }] }` (`confirmedAt` = booking `updatedAt`; `confirmed` is terminal) |

- `POST /bookings` when the child already has a live (`pending_payment` / `payment_failed` /
  `confirmed`) booking for that class returns **409** with `data.existingBookingId` (via
  `ConflictException`) so the UI can link to it. No second pending row.
- Paying an already-`confirmed` or `cancelled` booking → **409** (not payable). Paying a
  `payment_failed` booking is a **retry** (new `payment_attempts` row).
- A full class in `GET /trial-classes` still appears (`seatsLeft: 0`) so the UI can show "Full".

## Where each check lives (the README table)

| Check | UI | Backend (service) | Database | Background job |
|---|---|---|---|---|
| Valid ids / shapes | form validation (same Zod schema) | `validate()` 422 | FK constraints | — |
| Child belongs to parent | select filtered by parent | 404 if student not found | FK | — |
| Class full | "Full" badge, disabled (hint only) | count under lock → 409 | — (lock) | — |
| Duplicate child + class | — | existing confirmed/pending → 409 | partial unique index → 409 | — |
| Payment declined | error shown, retry link | `payment_failed`, no confirm | attempt row persisted | — |
| Last-seat race | — | serialized by `FOR NO KEY UPDATE` | row lock | — |
| Stale `pending_payment` rows | — | — | — | **not needed** (pending holds no seat); a sweep to `cancelled` after N minutes is a next step |

## Seed (`npm run db:seed`, through the service path)

| Case | Data |
|---|---|
| available seats | "Science – Volcanoes" with 1 confirmed |
| **exactly 3 confirmed** (the race class) | "Math – Fractions" with 3 confirmed → 1 seat left |
| full class | "Science – Space" with 4 confirmed → shows "Full" |
| duplicate attempt | a child who is already `confirmed` in "Volcanoes" — booking them again → 409 |
| payment failure | one `payment_failed` booking with a `failed` attempt (card `…0000`) |

Three parents, five students, three classes — leaves two free children (Leo Tan, Sofia Lim) for the
live last-seat demo on "Math – Fractions". Seed is idempotent (truncate then insert).

## Scope — in / out / next

- **In:** the 6 endpoints, 4 pages, seed, unit + integration tests (one per invariant + the race),
  README design section, AI_USAGE.md.
- **Out (documented cuts):** auth, parent-initiated cancel, regular enrollment, real payments +
  idempotency keys, price/amount on the model, pagination, pending-booking expiry job, email
  confirmations, capacity trigger at DB level.
- **Monitor after release:** 409 rate on `/payments` (seat lost after reaching checkout → UX signal),
  lock wait time on `trial_classes`, `payment_failed` ratio, any `23505` reaching `onError` (means a
  code path bypassed the service).
