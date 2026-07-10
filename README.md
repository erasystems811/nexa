# Nexa

*Powered by ERA.* Event supply marketplace — customers book verified providers,
Nexa holds the money until the job is done.

The product spec is [`PRD.md`](./PRD.md). Every non-obvious decision in this
codebase cites the section it came from.

## Status: Phase 1 foundation + in-app communication

Built:

- **In-app chat and masked calling** (Section 08). Customer ↔ provider chat tied
  to a listing or booking, realtime, shared by the Marketplace and Business
  Studio. Calls bridge through proxy numbers — neither side ever sees the
  other's real number, and `provider_contacts` keeps those numbers behind a
  row-level policy rather than a column grant.
- **Contact-info flagging.** Messages are scanned in a database trigger for
  phone numbers, bank account numbers, and off-platform solicitation. A flagged
  message still sends; Admin reviews it at `/admin/moderation`. Confirming a flag
  records it against the sender and does not create a strike — that stays an
  Admin judgment call (Section 05).

- **Project structure** — one module per domain (PRD Section 17), with the
  architectural boundaries enforced by ESLint rather than convention. See
  [`src/modules/README.md`](./src/modules/README.md).
- **Role-based auth** — Admin, Provider, Customer, Rider (Section 03). The
  permission model is Postgres RLS; `middleware.ts` only decides which URL a
  role may open.
- **Full Phase-1 schema** — Category (with fulfillment type), Provider, Rider
  (with vehicle type), Booking, Event Project, Reliability Score, Platform
  Settings, and the escrow ledger. Sections 04, 10, 17.
- **Feature flags** — Admin Console → Settings. Event Project and Reliability
  Score ship in the schema and default to OFF at the UI.
- **Payments behind an interface** — `holdFunds`, `releaseFunds`, `refund`.
  Nothing outside `modules/payments` can reach a processor.

Not built yet, by design: listings, bookings, payments flows, the rider flow, and
every marketplace screen.

### Verifying the communication layer

```bash
npm run e2e:messaging
```

Creates three throwaway accounts against the live project, drives chat, flagging,
isolation, and masked calling through the real module and the real RLS policies,
then deletes them. 31 assertions. It found two genuine leaks the first time it
ran, which is the only reason to trust the ones that pass now.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project's values
npm run dev
```

### Applying the schema

The migrations in `supabase/migrations/` are numbered and must run in order.

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
npm run db:types             # regenerates src/lib/db/types.ts from the real schema
```

They have not been run against a live Postgres yet — the schema was written
ahead of the project existing.

### Creating the first admin

Sign up through `/register`, then promote the account. Every new user is a
customer; the `handle_new_user` trigger allows nothing else, and no form can
change it. Run this once, in the Supabase SQL editor:

```sql
update public.profiles set role = 'admin' where id = '<the auth user id>';
```

Sign out and back in — the role is carried on the JWT, so it takes effect on the
next token.

## What the marketplace does not ship with

No categories. No cities. No providers. Not one.

PRD Section 01: *"There is no fixed launch category list. Categories are fully
open and admin-managed from day one — Admin adds a category the moment the first
real, verified provider in that category is onboarded."* Seeding Abuja and a
handful of plausible categories would have felt like progress and would have been
exactly the hardcoding Section 17 forbids.

The only seeded rows are platform settings and feature flags.

## Two things the PRD needs to resolve

**Payment release.** Section 10 specifies a two-stage escrow with an admin-set
stage-1 release percentage. Section 20's Resolved table says *"Single full
release on delivery confirmation code, not staged milestones."* These
contradict. The schema implements the staged model, because it is the superset:
setting `stage_1_release_percent` to 0 collapses it to a single release on the
code, with no code change. Someone should still pick one and fix the PRD.

**Deposit percentage.** Section 06 says a listing declares "a deposit percentage
within a platform-defined range." Section 20 says there is no platform-wide
default and it is negotiated per provider. Both are implemented: the range lives
in `platform_settings` (`deposit_percent_min` / `deposit_percent_max`), the
actual figure on `provider_agreements.deposit_percent`.

## Stack

Next.js (App Router) · TypeScript · TailwindCSS · Supabase (Postgres, Auth, RLS).
Money is stored in kobo as `bigint`, everywhere, always.
