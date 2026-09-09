# Client & UI — RSC reads, two client forms, shadcn

> The client half of the unified app, cut to the take-home scope. UI is **shadcn/ui + Tailwind**.
> There is **no TanStack Query**: every read is a Server Component calling a service; the only client
> code is the two forms, which call the Hono API through the shared `postJson` helper and
> `router.push` on success.

## The server/client split — decide per piece of work

Render on the server unless interactivity requires the client.

| Work | Mechanism | Layer used |
|------|-----------|-----------|
| Booking page data (parents → students, classes with seats left) | **Server Component** `page.tsx`: `await` the feature **service directly** | `app/ RSC → features/*/services/` |
| Booking status page, admin roster | **Server Component**, same path; `export const dynamic = 'force-dynamic'` (never cache a roster) | `app/ RSC → services/` |
| Submit booking, submit payment | **Client Component** (`'use client'`) form: react-hook-form + Zod resolver → `postJson(url, body, responseSchema)` → `router.push` | `components → shared/lib/api-client → /api/v1` |

- **Do NOT use Next.js Server Actions** for the forms — they would bypass the Hono API and its
  validation/error mapping, which is what the README documents and the integration tests cover.
- RSC calls the service **in-process** (no HTTP self-hop). The **response DTO is the same** whether it
  came from the service (RSC) or the API (client).
- Add TanStack Query only when a client-side read appears (e.g. live seat count polling). Say so in
  the README "next steps" instead of adding it now.

## Forms & validation

- **react-hook-form + `@hookform/resolvers/zod`** with the **request DTO** as the resolver schema —
  shadcn's `Form` is built on react-hook-form, and the *same* Zod schema validates the form and the
  server's `validate()` (one source of truth for input).
- **One HTTP path for every form:** `postJson(url, body, dataSchema)` in `shared/lib/api-client/`
  POSTs JSON, parses the `{ message, data }` envelope with `clientResponseSchema`, returns `data`, and
  throws `ApiClientError { status, message, data }` on non-2xx. Forms never call `fetch` directly.
- A `409` ("class is full" / "already booked") is a normal, expected outcome — render `message` inline
  in a `role="alert"` with a link to the booking (`data.existingBookingId` when present).
- Disable **only** the submitting button while pending (`Booking…` / `Paying…`); never freeze the page.
- Payment form has one field: `cardNumber` (digits, 12–19, spaces stripped; ends in `0000` → declined
  by the mock). Nothing is stored beyond `card_last4`.
- Both forms use react-hook-form; the parent `<select>` in the booking form is UI-only state that
  narrows the child list and calls `form.resetField('studentId')`.

## Dates

The wire carries ISO strings. Every rendered date goes through `formatDateTime(iso)`
(`shared/utils/format-date-time/`) which pins `APP_LOCALE` + `APP_TIME_ZONE`
(`shared/constants/app.ts`). Never call `toLocaleString()` in a component: server and browser differ
in locale/time zone and the client component would hydrate with a mismatch.

## Pages (all under `app/`, thin)

| Route | Kind | Shows |
|---|---|---|
| `/` | RSC + client `BookingForm` | parent select → child select, class list with `seatsLeft`, submit |
| `/bookings/[id]/pay` | RSC shell + client `PaymentForm` | booking summary, mock card form; redirects to status if not payable |
| `/bookings/[id]` | RSC | status badge, cancellation reason text, payment attempts, retry link when retryable |
| `/admin` | RSC | every trial class with confirmed count and roster (child, parent, confirmed at) |
| `not-found.tsx` / `error.tsx` | Next.js conventions | a service 404 becomes the not-found page via `orNotFound()` (`shared/lib/next/`); unexpected errors get a reset button |

## UI (shadcn/ui + Tailwind)

- Primitives from the shadcn CLI live in `shared/components/ui/` (install only what is used: `button`,
  `card`, `input`, `label`, `badge`, `table`, `native-select` if available). The site header lives in
  `shared/components/app/site-header.tsx`.
- Selects are **native `<select>`** (no Radix in jsdom, accessible by default), styled with the same
  classes as `Input`. Class choice is a native radio list; the visible label text is the accessible
  name — no `aria-label` overrides.
- Feature UI in `features/<d>/components/`. `app/` owns no components.
- The backend is authoritative: the UI may hide full classes or disable a button for UX, but must
  never assume an operation is legal — the API validates and can reject.

## JSX conditional rendering — ternary, never `&&`

```tsx
{isPending ? <Spinner /> : null}     // YES
{seatsLeft > 0 ? <Book /> : null}    // YES
{seatsLeft && <Book />}              // NO — `0 && …` renders "0"
```

Not conditional rendering, so leave as `&&`: the `cn(isFull && 'opacity-50')` idiom and boolean logic
feeding a ternary.

## Feedback basics

- Errors where the user is looking: inline `FormMessage` on fields, an inline alert (`role="alert"`)
  for API errors.
- Always render an explicit **empty state** ("No bookings yet."), never a blank list.
- Full classes render disabled with "Full"; the seat count is a hint, the server is the judge.
