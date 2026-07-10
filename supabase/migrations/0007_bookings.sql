-- 0007_bookings.sql
-- Event Projects, Bookings, confirmation codes, rider assignments.
-- PRD Sections 04, 07, 09, 10, 15.
--
-- Event Project ships in the schema now and stays behind the `plan_my_event`
-- feature flag (Section 17). Nothing here is Phase-2-only.

create table public.event_projects (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references public.profiles (id) on delete cascade,
  event_type_id uuid references public.event_types (id) on delete set null,
  title         text not null,
  event_date    date,
  city_id       uuid references public.cities (id) on delete set null,
  budget_kobo   bigint check (budget_kobo >= 0),
  guest_count   integer check (guest_count > 0),
  status        public.event_project_status not null default 'draft',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index event_projects_customer_idx on public.event_projects (customer_id);

create trigger event_projects_set_updated_at
  before update on public.event_projects
  for each row execute function public.set_updated_at();

-- Section 07: "one shared checklist and one status dashboard".
create table public.event_project_checklist_items (
  id                uuid primary key default gen_random_uuid(),
  event_project_id  uuid not null references public.event_projects (id) on delete cascade,
  label             text not null,
  is_done           boolean not null default false,
  booking_id        uuid,  -- fk added below, once bookings exists
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Bookings
-- ---------------------------------------------------------------------------

create table public.bookings (
  id                uuid primary key default gen_random_uuid(),
  reference         text not null unique,

  customer_id       uuid not null references public.profiles (id) on delete restrict,
  provider_id       uuid not null references public.providers (id) on delete restrict,
  listing_id        uuid not null references public.listings (id) on delete restrict,

  -- Null for a Search & Book booking; set when the booking belongs to a
  -- Plan My Event checkout. Same booking engine either way (Section 07).
  event_project_id  uuid references public.event_projects (id) on delete set null,

  -- Copied from the category at creation, not joined at read time. A category's
  -- fulfillment type changing later must not retroactively rewrite how an
  -- in-flight booking releases money.
  fulfillment_type  public.fulfillment_type not null,

  status            public.booking_status not null default 'pending',

  scheduled_start   timestamptz not null,
  scheduled_end     timestamptz,
  address           text,
  address_lat       numeric(9,6),
  address_lng       numeric(9,6),
  notes             text,

  -- The agreed price. For a negotiable listing this is the number the parties
  -- settled on in chat, not the listing's asking price (Section 08).
  agreed_price_kobo bigint not null check (agreed_price_kobo >= 0),
  delivery_fee_kobo bigint not null default 0 check (delivery_fee_kobo >= 0),
  caution_fee_kobo  bigint not null default 0 check (caution_fee_kobo >= 0),

  -- Percentages resolved at creation time from provider agreement -> platform
  -- setting. Frozen onto the booking so that an admin editing the commission
  -- next week does not silently restate money owed on a booking already in flight.
  commission_percent          numeric(5,2) not null check (commission_percent between 0 and 100),
  stage_1_release_percent     numeric(5,2) not null check (stage_1_release_percent between 0 and 100),
  late_penalty_percent_per_30min numeric(5,2) not null default 0 check (late_penalty_percent_per_30min between 0 and 100),

  accepted_at       timestamptz,
  rejected_at       timestamptz,
  cancelled_at      timestamptz,
  cancelled_by      uuid references public.profiles (id) on delete set null,
  cancellation_reason text,

  -- Stage 1 checkpoint: rider pickup, provider check-in, or provider acceptance,
  -- depending on fulfillment type (Section 10).
  stage_1_at        timestamptz,
  stage_2_at        timestamptz,
  completed_at      timestamptz,

  -- Section 10: late-arrival penalty is computed from this, not self-reported.
  provider_arrived_at timestamptz,
  late_minutes      integer not null default 0 check (late_minutes >= 0),

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- Section 10: a caution fee only exists on Delivery + Return.
  constraint bookings_caution_only_on_return check (
    caution_fee_kobo = 0 or fulfillment_type = 'delivery_return'
  ),
  -- Section 15: services never involve a rider, so they never carry a delivery fee.
  constraint bookings_delivery_fee_only_on_goods check (
    delivery_fee_kobo = 0 or fulfillment_type in ('delivery', 'delivery_return')
  )
);

create index bookings_customer_idx on public.bookings (customer_id, status);
create index bookings_provider_idx on public.bookings (provider_id, status);
create index bookings_event_project_idx on public.bookings (event_project_id);
create index bookings_scheduled_idx on public.bookings (scheduled_start);

create trigger bookings_set_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

alter table public.event_project_checklist_items
  add constraint event_project_checklist_items_booking_id_fkey
  foreign key (booking_id) references public.bookings (id) on delete set null;

alter table public.provider_strikes
  add constraint provider_strikes_booking_id_fkey
  foreign key (booking_id) references public.bookings (id) on delete set null;

create sequence public.booking_reference_seq;

create or replace function public.assign_booking_reference()
returns trigger
language plpgsql
as $$
begin
  if new.reference is null or new.reference = '' then
    new.reference := 'NX-' || to_char(nextval('public.booking_reference_seq'), 'FM000000');
  end if;
  return new;
end;
$$;

create trigger bookings_assign_reference
  before insert on public.bookings
  for each row execute function public.assign_booking_reference();

-- ---------------------------------------------------------------------------
-- Confirmation codes — PRD Section 04, 10
-- ---------------------------------------------------------------------------
-- "shown only to the customer... This is what actually moves a stage forward —
-- never a rider or provider simply marking something done."
--
-- Stage 1 needs a code only for delivery_return (the drop-off). Every other
-- fulfillment type's stage 1 is an operational checkpoint (rider scans pickup,
-- provider checks in) with no customer present to read a code out.

create table public.booking_confirmation_codes (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid not null references public.bookings (id) on delete cascade,
  stage        smallint not null check (stage in (1, 2)),
  code         text not null default public.generate_confirmation_code(),
  consumed_at  timestamptz,
  consumed_by  uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (booking_id, stage)
);

create index booking_confirmation_codes_booking_idx on public.booking_confirmation_codes (booking_id);

-- Codes are minted when the money is actually held, not at booking creation —
-- a pending booking the provider may still reject has nothing to confirm.
create or replace function public.mint_confirmation_codes()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'paid_held' and old.status is distinct from 'paid_held' then
    insert into public.booking_confirmation_codes (booking_id, stage)
    values (new.id, 2)
    on conflict do nothing;

    if new.fulfillment_type = 'delivery_return' then
      insert into public.booking_confirmation_codes (booking_id, stage)
      values (new.id, 1)
      on conflict do nothing;
    end if;
  end if;
  return new;
end;
$$;

create trigger bookings_mint_codes
  after update of status on public.bookings
  for each row execute function public.mint_confirmation_codes();

-- ---------------------------------------------------------------------------
-- Rider assignments — PRD Section 15
-- ---------------------------------------------------------------------------
-- "Large orders can be assigned to more than one rider as a team on the same
-- booking — the booking doesn't split, the assignment does." So this is a
-- many-to-one table, not a rider_id column on bookings.

create table public.rider_assignments (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references public.bookings (id) on delete cascade,
  rider_id    uuid not null references public.riders (id) on delete restrict,

  -- Which leg: 1 = outbound drop-off, 2 = return pickup (delivery_return only).
  leg         smallint not null default 1 check (leg in (1, 2)),

  status      public.rider_assignment_status not null default 'assigned',
  assigned_by uuid references public.profiles (id) on delete set null,
  assigned_at timestamptz not null default now(),
  accepted_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,

  -- Section 15: rider notes visible condition on return pickup.
  condition_notes text,

  -- Section 10: delivery-only pays in full on the code; delivery+return splits
  -- half on drop-off, half on return.
  fee_share_kobo bigint not null default 0 check (fee_share_kobo >= 0),

  created_at  timestamptz not null default now(),
  unique (booking_id, rider_id, leg)
);

create index rider_assignments_rider_idx on public.rider_assignments (rider_id, status);
create index rider_assignments_booking_idx on public.rider_assignments (booking_id);

-- A rider is never attached to a service booking (Section 15). The DB refuses,
-- not just the application layer.
create or replace function public.reject_rider_on_service_booking()
returns trigger
language plpgsql
as $$
declare
  ft public.fulfillment_type;
begin
  select fulfillment_type into ft from public.bookings where id = new.booking_id;
  if not public.fulfillment_uses_rider(ft) then
    raise exception 'Cannot assign a rider to a % booking', ft
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger rider_assignments_guard
  before insert or update on public.rider_assignments
  for each row execute function public.reject_rider_on_service_booking();
