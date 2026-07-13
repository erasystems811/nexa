# Nexa

*Powered by ERA.* Nexa is an **event services marketplace**. Customers find, compare,
contact, and book verified vendors for the services an event needs — catering, DJs,
photography, decor, sound, venues, security, transport, and the rest.

This README is the spec. There is no separate PRD; the code and this document are
the source of truth.

## What Nexa sells

**Services, not products.** A caterer is not selling food, they are selling the
catering *service* — showing up, cooking, serving, clearing. A transport company is
selling the moving *service*. Every vendor owns their own fulfillment: they turn up
and do the job they listed.

There is no Nexa rider network. **Transport & logistics companies are ordinary
vendors** in their own category, like every other vendor.

## How Nexa makes money

Two revenue lines, and only two:

1. **Commission** — a percentage of each booking, taken automatically because Nexa
   holds the customer's payment and pays the vendor out. Set in Admin → Settings
   (`commission_percent`), changeable without a deploy.
2. **Monthly platform fee** — vendors pay a recurring fee to stay listed. If the fee
   lapses, their listings are hidden from the marketplace and they stop getting
   leads. They keep Business Studio access so they can see existing bookings and pay up.

## How the money moves

Nexa *is* the escrow — there is no third-party escrow product.

1. **Collect** — the customer pays through Flutterwave's hosted checkout. The money
   lands in Nexa's own Flutterwave balance.
2. **Hold** — Nexa simply doesn't pay it out yet. That is the hold.
3. **Deposit release** — when the vendor accepts the booking, their deposit share is
   transferred to their bank account, so they can buy materials. The deposit
   percentage is negotiated per vendor and recorded on their agreement.
4. **Balance release** — the customer receives a confirmation code at booking. When
   the service is done, they give it to the vendor. Entering that code releases the
   balance, minus commission. **A vendor cannot get paid by simply tapping "done".**
5. **Refund** — before the vendor accepts, cancellation is a full automatic refund.
   After that it follows the vendor's own tiered cancellation policy.

Money is stored in kobo as `bigint` throughout.

## Communication

Customers and vendors **never exchange phone numbers.** They both message Nexa's
WhatsApp business number, and Nexa relays between them — neither side sees the
other's number. Messages are scanned for phone numbers and bank details; attempts
to move off-platform are blocked and flagged for Admin.

## Surfaces

One app, three surfaces, split by subdomain.

| Surface | Domain | Purpose |
| --- | --- | --- |
| Marketplace | `nexa.erasystems.com.ng` | Customers discover, compare, contact, and book vendors. |
| Business Studio | `vendor.nexa.erasystems.com.ng` | Vendors manage their profile, listings, availability, bookings, reviews, payouts, and subscription. |
| Admin Console | `admin.nexa.erasystems.com.ng` | Nexa staff verify vendors, approve listings, monitor bookings and money, handle disputes and support, manage subscriptions and settings. |

Locally (and on the raw Railway URL) `NEXT_PUBLIC_ROOT_DOMAIN` is unset and every
surface is reachable by path instead: `/`, `/studio`, `/admin`.

## Trust

No vendor appears publicly without manual review. Verification covers business
details, ID (NIN), bank account, sample media, and references. Talent categories
require video, not photos. Suspension hides a vendor's listings immediately.

## Stack

Next.js App Router, TypeScript, TailwindCSS, Supabase (Postgres / Auth / RLS),
Flutterwave (payments), Resend (email), Railway (hosting).

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill it in
npm run dev
```

### Checks

```bash
npm run typecheck
npm run lint
```

### Applying the schema

Migrations in `supabase/migrations/` are numbered and run in order.

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push
npm run db:types
```

## Admin access

Admin is a fixed login set by environment variables — `NEXA_SUPER_ADMIN_USERNAME`,
`NEXA_SUPER_ADMIN_EMAIL`, and `NEXA_SUPER_ADMIN_PASSWORD`. Change the password by
changing the variable and redeploying. Sign in on the `admin.` subdomain.

## Onboarding a vendor

Admin → Providers → Add Provider. Nexa creates the account and emails the vendor a
link to set their password. Once they set it they can sign in to Business Studio,
build their profile, and submit listings — which enter the approval queue before
they go live.
