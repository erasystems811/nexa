# Nexa

*Powered by ERA.* Nexa is an event vendor access marketplace: customers discover,
contact, compare, and book verified event vendors and service providers.

The product spec starts with [`PRD.md`](./PRD.md), then
[`PRD_ADDENDUM_v1.1.md`](./PRD_ADDENDUM_v1.1.md), and now
[`PRD_ADDENDUM_v1.2.md`](./PRD_ADDENDUM_v1.2.md). Where the documents disagree,
the newest addendum wins.

## Product Direction

Addendum v1.2 supersedes the old Nexa-operated rider network. Nexa no longer has
registered riders as a separate operational pool. Car, van, bus, truck, dispatch,
and logistics companies are ordinary providers on the marketplace, listed under
transport/logistics categories.

The core marketplace is now an access space for event vendors. Customers and
vendors discover each other, communicate, negotiate, and book where enabled. The
vendor owns ordinary fulfillment. **Plan Your Event** is the managed-service
layer where Nexa can take responsibility for planning, coordination, vendor
selection, and event execution support.

## Current Implementation Status

The codebase was originally built against the older four-surface model. This
branch is pivoting it toward the v1.2 model.

Already updated on this branch:

- Added the v1.2 product addendum.
- Removed the Rider App and Admin Riders pages from live app routes.
- Reduced subdomain routing to three primary surfaces: Marketplace, Business Studio, Admin.
- Redirected `/rider` paths back to Marketplace while legacy data is migrated.
- Removed rider applications from the Admin dashboard and navigation.
- Renamed Rider Operations staff role copy toward Transport & Logistics Vendor Manager.
- Changed Business Studio order actions from "Call a bike/car/van" to provider-owned fulfillment.
- Removed platform delivery-fee presentation from checkout copy.
- Added a migration that disables/deprecates legacy rider delivery feature flags.

Still intentionally legacy pending the next phase:

- Rider tables and generated database types remain in the schema for data/history.
- Rider-specific payment ledger kinds and payout helpers remain until booking/payment is redesigned.
- Old e2e rider tests are no longer representative of the product direction.
- Plan Your Event still needs to be built as the managed coordination layer.

## Surfaces

| Surface | Purpose |
| --- | --- |
| Marketplace | Customers discover, contact, compare, and book event vendors. |
| Business Studio | Providers manage profiles, listings, leads, bookings, media, reviews, and payout details. |
| Admin Console | Nexa staff verify providers, approve listings, support customers, manage disputes, settings, staff, and Plan Your Event operations. |

Transport/logistics providers use Business Studio like every other provider.
There is no standalone Rider App in the v1.2 product model.

## Getting Started

```bash
npm install
cp .env.example .env.local
npm run dev
```

### Checks

```bash
npm run typecheck
npm run lint
```

### Applying The Schema

The migrations in `supabase/migrations/` are numbered and must run in order.

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
npm run db:types
```

## Creating The First Admin

Sign up through `/register`, then promote the account in Supabase SQL editor:

```sql
update public.profiles set role = 'admin' where id = '<the auth user id>';
```

Sign out and back in. The role is carried on the JWT, so it takes effect on the
next token.

## Stack

Next.js App Router, TypeScript, TailwindCSS, Supabase Postgres/Auth/RLS. Money is
stored in kobo as `bigint`.