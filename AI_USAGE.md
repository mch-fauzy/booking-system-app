# AI usage

## Which AI tools I used

**Claude Code** (Opus for planning and review, Sonnet for implementation) as the main driver, with
project-specific rules checked into `.claude/rules/` so the agent had a written spec for structure,
boundaries and domain behaviour rather than inventing conventions per file. **Context7** for
version-accurate library documentation (Drizzle, Vitest, Hono, Zod 4), since several of these had
breaking changes more recent than the model's training data.

## What I used it for

- Drafting an implementation plan from the brief before writing any code, then executing it task by task.
- Scaffolding configuration: ESLint boundaries and folder-structure rules, knip, husky, the Vitest
  unit/integration project split.
- Writing tests first for each unit of work, then the implementation to satisfy them.
- Drafting this README's design sections, which I then corrected against the code.

## One place AI helped me move faster

The enforcement setup. Import boundaries (`shared → features → app`, no cross-feature imports), the
folder-structure rules, knip, and the husky pre-commit hook were ported and adapted in minutes rather
than the hour it usually takes to get `eslint-plugin-boundaries` configured correctly.

That paid off immediately and in a way I did not expect: when I wrote the booking form, the boundaries
rule rejected the build because the component imported `TrialClassResponse` from the `trial-class`
feature — a cross-feature import that I had written into the plan myself and would not have noticed by
eye. The fix was to give the component its own prop type and let `app/` compose the two features. The
tooling caught a design error, not a typo.

## One place I disagreed with, corrected, or rejected AI output

Several, and the concurrency ones mattered most:

- **`FOR UPDATE` → `FOR NO KEY UPDATE`.** The first draft locked the class row with `FOR UPDATE`. That
  is correct for capacity but conflicts with the `FOR KEY SHARE` lock a foreign-key insert takes, so
  one parent paying would block every other parent from creating a pending booking for that class. I
  verified the difference against the real database before changing it: a competing insert finished in
  1307 ms under `FOR NO KEY UPDATE` while the payer still held the lock, versus 3856 ms under
  `FOR UPDATE`, where it had to wait for release.
- **Throwing inside the transaction.** The draft threw `ClassFull` from inside the `db.transaction`
  callback — which rolls back the very `cancelled` write it had just made, so the booking would have
  been left `pending_payment`. Changed to return an outcome and throw after the commit.
- **Unstated isolation level.** The transaction relied on Postgres defaulting to `READ COMMITTED`
  without saying so anywhere. Under `REPEATABLE READ` the same locking read aborts with `40001` and
  needs a retry loop, so the invariant silently depended on a default. It is now pinned explicitly with
  a comment explaining why.
- **Audit columns.** The first schema draft carried `created_by` / `updated_by`. With no authentication
  in scope they would always be null — dead columns. Removed.
- **A test I let slip.** I asked for an `eslint-disable` to be removed rather than accepted after it
  appeared in a diff, and separately caught a test whose name claimed it asserted a 409 when it
  actually asserted a 404. Renamed to match the assertion.

## What I would change about my AI workflow

- **Write the race test before the service.** I let the implementation land first and the concurrency
  test second. Reversing that would have surfaced the `FOR UPDATE` and throw-inside-transaction
  problems as failures rather than as review findings.
- **Pin versions in the plan.** Several corrections were version drift — Zod 4's inference, Vitest 5's
  project config, `eslint-plugin-boundaries` v7 renaming `rules` to `policies`. Checking the installed
  version before accepting generated config would have avoided a round trip each time.
- **Distrust "correct" for anything concurrent.** Every concurrency bug above type-checked, linted, and
  would have passed a single-threaded test. Only a test with two real connections, or reading the
  Postgres lock-conflict table, exposed them.

## How I verified the final implementation

- `npm run test:integration` — one test per invariant, including the last-seat race running two real
  concurrent transactions and asserting exactly one `confirmed` and one 409.
- A separate test proving the partial unique index rejects a direct insert that bypasses the service,
  so the backstop is verified rather than assumed.
- An HTTP-level integration test through Hono covering status codes and error envelopes (422 on a bad
  body, 409 with `existingBookingId`, 201 for both a declined and a successful charge).
- `npm run test:coverage` — ~94% statements, ~92% branches against an 80% threshold.
- A manual two-tab run on the seeded "Math – Fractions" class (1 seat left): both parents reach the
  payment page, the first to pay is confirmed, the second gets "Trial class is full" with the booking
  cancelled and **no** payment attempt recorded.
- `npm run lint && npm run knip && npm run check:exports && npm run build` clean, all enforced by a
  pre-commit hook.

The measurements quoted in this file and the README (lock timings, round-trip latency) were taken
against the actual Neon database used by the project, not estimated.
