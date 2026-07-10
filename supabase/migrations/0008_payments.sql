-- 0008_payments.sql
-- Escrow records and the money ledger. PRD Section 10.
--
-- Nothing in this file names Flutterwave. The gateway is an implementation
-- detail recorded in `gateway` / `gateway_reference` (Section 17: "the escrow
-- logic and data model do not assume Flutterwave specifically").

create table public.payments (
  id                uuid primary key default gen_random_uuid(),
  booking_id        uuid not null unique references public.bookings (id) on delete restrict,

  -- What the customer paid in total, and how it decomposes.
  amount_kobo       bigint not null check (amount_kobo >= 0),          -- the agreed price
  delivery_fee_kobo bigint not null default 0 check (delivery_fee_kobo >= 0),
  caution_fee_kobo  bigint not null default 0 check (caution_fee_kobo >= 0),

  commission_kobo   bigint not null default 0 check (commission_kobo >= 0),

  status            public.payment_status not null default 'pending',

  held_kobo         bigint not null default 0 check (held_kobo >= 0),
  released_kobo     bigint not null default 0 check (released_kobo >= 0),
  refunded_kobo     bigint not null default 0 check (refunded_kobo >= 0),
  penalty_kobo      bigint not null default 0 check (penalty_kobo >= 0),

  -- Section 10: the caution fee is "held apart from the regular escrow flow —
  -- it is not part of the provider's payout calculation".
  caution_held_kobo    bigint not null default 0 check (caution_held_kobo >= 0),
  caution_refunded_kobo bigint not null default 0 check (caution_refunded_kobo >= 0),
  caution_claimed_kobo  bigint not null default 0 check (caution_claimed_kobo >= 0),

  stage_1_released_at timestamptz,
  stage_2_released_at timestamptz,

  -- Which processor moved the money, and its id for that transaction. Swapping
  -- processors means new rows with a different `gateway`, not a migration.
  gateway           text,
  gateway_reference text,
  gateway_metadata  jsonb not null default '{}'::jsonb,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index payments_status_idx on public.payments (status);
create index payments_gateway_ref_idx on public.payments (gateway, gateway_reference);

create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

-- Append-only ledger. Every kobo that moves gets a row. This is what the Admin
-- Console's escrow balance, commission tracking, and payout reports read from —
-- balances are derived, never trusted as a single mutable number.
create table public.payment_ledger_entries (
  id           uuid primary key default gen_random_uuid(),
  payment_id   uuid not null references public.payments (id) on delete restrict,
  booking_id   uuid not null references public.bookings (id) on delete restrict,
  kind         public.payment_ledger_kind not null,

  -- Signed: positive is money into the named party, negative is out.
  amount_kobo  bigint not null,

  -- Exactly one beneficiary, or none for platform-retained amounts.
  provider_id  uuid references public.providers (id) on delete set null,
  rider_id     uuid references public.riders (id) on delete set null,
  customer_id  uuid references public.profiles (id) on delete set null,

  stage        smallint check (stage in (1, 2)),
  note         text,
  gateway_reference text,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index payment_ledger_payment_idx on public.payment_ledger_entries (payment_id);
create index payment_ledger_booking_idx on public.payment_ledger_entries (booking_id);
create index payment_ledger_provider_idx on public.payment_ledger_entries (provider_id);

-- The ledger is history. History does not get edited.
create or replace function public.reject_ledger_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'payment_ledger_entries is append-only'
    using errcode = 'insufficient_privilege';
end;
$$;

create trigger payment_ledger_no_update
  before update or delete on public.payment_ledger_entries
  for each row execute function public.reject_ledger_mutation();

-- Section 10: penalty money is retained by Nexa; 30% is passed to the affected
-- customer as compensation, 70% retained. Both shares are settings (0010), so
-- this table records what was actually applied at the time.
create table public.penalty_applications (
  id                 uuid primary key default gen_random_uuid(),
  booking_id         uuid not null references public.bookings (id) on delete restrict,
  payment_id         uuid not null references public.payments (id) on delete restrict,
  reason             text not null,
  late_minutes       integer not null default 0,
  penalty_kobo       bigint not null check (penalty_kobo >= 0),
  customer_share_kobo bigint not null check (customer_share_kobo >= 0),
  platform_share_kobo bigint not null check (platform_share_kobo >= 0),
  applied_by         uuid references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now(),
  constraint penalty_shares_sum check (customer_share_kobo + platform_share_kobo = penalty_kobo)
);

-- Section 10 / 13: payouts settle on a schedule, giving admin a window to catch
-- disputes before money leaves the platform.
create table public.payouts (
  id           uuid primary key default gen_random_uuid(),
  provider_id  uuid references public.providers (id) on delete restrict,
  rider_id     uuid references public.riders (id) on delete restrict,
  amount_kobo  bigint not null check (amount_kobo > 0),
  status       text not null default 'pending' check (status in ('pending', 'processing', 'paid', 'failed')),
  gateway      text,
  gateway_reference text,
  scheduled_for timestamptz,
  paid_at      timestamptz,
  failure_reason text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint payouts_one_beneficiary check (num_nonnulls(provider_id, rider_id) = 1)
);

create trigger payouts_set_updated_at
  before update on public.payouts
  for each row execute function public.set_updated_at();

-- Gateway callbacks land here first and are processed idempotently. A processor
-- that retries a webhook must not release the same stage twice.
create table public.payment_webhook_events (
  id           uuid primary key default gen_random_uuid(),
  gateway      text not null,
  event_id     text not null,
  event_type   text,
  payload      jsonb not null,
  processed_at timestamptz,
  error        text,
  received_at  timestamptz not null default now(),
  unique (gateway, event_id)
);
