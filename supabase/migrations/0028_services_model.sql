-- 0028_services_model.sql
-- The pivot, at the database layer: Nexa is an EVENT SERVICES marketplace.
--
-- Everything in 0001..0027 was built for a product-delivery marketplace that also
-- sold services: riders, delivery fees, caution deposits on rentals, two
-- confirmation codes on a delivery+return. None of that is the business any more.
-- A transport company is now just a vendor in a Transport & Logistics category,
-- and it books like a DJ books.
--
-- 0025/0026 archived the rider surface behind raising functions but kept the
-- tables, columns, and enum values. That halfway state is what this migration
-- finishes. The business tables are empty (0 providers, 0 listings, 0 bookings,
-- 0 payments, 0 riders, 0 conversations), so the destructive half is safe; the
-- rows that DO exist — profiles, cities, categories, platform_settings,
-- feature_flags, staff_members — are preserved throughout.
--
-- Postgres cannot remove a value from an enum. Every enum below is therefore
-- rebuilt the only way that works: rename the old type, create the new one, ALTER
-- every dependent column with a USING cast, then drop the old type. `drop type
-- ... cascade` is deliberately never used — it would silently take dependent
-- columns and RLS policies with it. Dependents are dropped by name, in order.

-- ---------------------------------------------------------------------------
-- 1. Repair 0027.
-- ---------------------------------------------------------------------------
-- 0027 creates an index on whatsapp_threads.provider_whatsapp_contact_id but
-- never creates the column. The live database HAS the column (the generated
-- types were produced from it), so this is a no-op there. It exists so the
-- column is defined in the migration history at all.

alter table public.whatsapp_threads
  add column if not exists provider_whatsapp_contact_id uuid
    references public.whatsapp_contacts (id) on delete set null;

create index if not exists whatsapp_threads_provider_contact_idx
  on public.whatsapp_threads (provider_whatsapp_contact_id);

-- ---------------------------------------------------------------------------
-- 2. Unhook the rider model from the tables that survive.
-- ---------------------------------------------------------------------------
-- payouts.rider_id and payment_ledger_entries.rider_id are foreign keys into
-- `riders`, so `riders` cannot be dropped while they exist. Both columns are
-- referenced by RLS policies, and Postgres refuses to drop a column a policy
-- depends on — so the policies come down first and go back up without the rider
-- arm. bookings_read_participants goes the same way because it calls
-- assigned_to_booking_as_rider(), which is about to stop existing.

drop policy if exists bookings_read_participants on public.bookings;
drop policy if exists payment_ledger_read_own on public.payment_ledger_entries;
drop policy if exists payouts_read_own on public.payouts;

-- num_nonnulls(provider_id, rider_id) = 1 stops meaning anything with one of the
-- two columns gone. Dropping the column would take the constraint anyway; naming
-- it makes the intent visible.
alter table public.payouts
  drop constraint if exists payouts_one_beneficiary;

alter table public.payouts
  drop column if exists rider_id;

-- A payout now always has exactly one beneficiary: the provider.
alter table public.payouts
  alter column provider_id set not null;

alter table public.payment_ledger_entries
  drop column if exists rider_id;

create policy bookings_read_participants on public.bookings
  for select to authenticated
  using (
    customer_id = (select auth.uid())
    or provider_id = public.my_provider_id()
  );

create policy payment_ledger_read_own on public.payment_ledger_entries
  for select to authenticated
  using (
    provider_id = public.my_provider_id()
    or customer_id = (select auth.uid())
  );

create policy payouts_read_own on public.payouts
  for select to authenticated
  using (provider_id = public.my_provider_id());

-- ---------------------------------------------------------------------------
-- 3. Drop the rider tables.
-- ---------------------------------------------------------------------------
-- Children first, so no drop needs CASCADE. Each drop takes its own indexes,
-- triggers, and RLS policies with it (riders_read_own, riders_apply,
-- riders_update_own, riders_guard_self_approval, rider_documents_*,
-- rider_reliability_read_own, rider_wallets_*, rider_assignments_*, and the
-- admin_all policies from 0011), plus the column grants from 0013/0015.

drop table if exists public.rider_assignments;
drop table if exists public.rider_documents;
drop table if exists public.rider_reliability;
drop table if exists public.rider_wallets;
drop table if exists public.riders;

-- 0023 and 0026 both dropped this trigger, so it should not exist — but a trigger
-- holds a hard dependency on its function, so if any path did recreate it, the
-- drop of assign_outbound_rider() below would fail. Take it out first.
drop trigger if exists bookings_assign_outbound_rider on public.bookings;

-- The functions the rider model hung off. Some of these must go before their
-- argument enums can be dropped further down; all of them are dead either way.
-- (Function bodies are not dependency-tracked in Postgres, so these would have
-- survived the table drops as silently broken functions.)

drop function if exists public.assigned_to_booking_as_rider(uuid);
drop function if exists public.my_rider_id();
drop function if exists public.guard_rider_assignment_write();
drop function if exists public.guard_rider_self_approval();
drop function if exists public.reject_rider_on_service_booking();
drop function if exists public.bootstrap_rider_rows();
drop function if exists public.sync_rider_role();
drop function if exists public.assign_outbound_rider();
drop function if exists public.pick_delivery_rider(uuid, boolean, uuid[]);
drop function if exists public.pick_rider_by_vehicle(uuid, public.vehicle_type, uuid[]);
drop function if exists public.rider_leg_fee(bigint, public.fulfillment_type, smallint);
drop function if exists public.fulfillment_uses_rider(public.fulfillment_type);

-- With riders.vehicle_type and rider_assignments.status gone, and the two
-- functions that took vehicle_type / fulfillment_type as arguments gone, these
-- two enums have no dependents left.
drop type if exists public.vehicle_type;
drop type if exists public.rider_assignment_status;

-- ---------------------------------------------------------------------------
-- 4. user_role: remove 'rider'.
-- ---------------------------------------------------------------------------
-- Dependents, all three of them:
--   profiles.role                  (column, with a default)
--   feature_flags.enabled_for_roles (ARRAY of the enum — easy to miss)
--   current_role_name()            (RETURN type — create-or-replace cannot change
--                                   a return type, so the function is dropped and
--                                   rebuilt; nothing has a recorded dependency on
--                                   it, because is_admin()/is_feature_enabled()
--                                   only name it inside their bodies)

-- Data first, while the old type still accepts the old values. There are no
-- rider profiles, but a migration that only works on a database it has already
-- seen is not a migration.
update public.profiles
   set role = 'customer'
 where role::text = 'rider';

update public.feature_flags
   set enabled_for_roles = nullif(
         array_remove(enabled_for_roles, 'rider'::public.user_role),
         '{}'::public.user_role[]
       )
 where enabled_for_roles is not null;

alter table public.profiles alter column role drop default;

drop function if exists public.current_role_name();

-- profiles_sync_role is declared `after insert or update OF role`. Naming the
-- column in the trigger makes the trigger depend on it, and Postgres flatly
-- refuses to retype a column a trigger depends on. Drop it, retype, put it back
-- — the function it calls is untouched, so this is only the binding.
drop trigger if exists profiles_sync_role on public.profiles;

alter type public.user_role rename to user_role_old;

create type public.user_role as enum ('admin', 'provider', 'customer');

alter table public.profiles
  alter column role type public.user_role
  using role::text::public.user_role;

alter table public.feature_flags
  alter column enabled_for_roles type public.user_role[]
  using enabled_for_roles::text[]::public.user_role[];

alter table public.profiles alter column role set default 'customer';

create trigger profiles_sync_role
  after insert or update of role on public.profiles
  for each row execute function public.sync_role_to_auth_metadata();

create or replace function public.current_role_name()
returns public.user_role
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb
      -> 'app_metadata' ->> 'role',
    'customer'
  )::public.user_role;
$$;

drop type public.user_role_old;

-- ---------------------------------------------------------------------------
-- 5. payment_ledger_kind: remove the rider payout and the three caution kinds.
-- ---------------------------------------------------------------------------
-- Only one dependent: payment_ledger_entries.kind. The ledger is append-only and
-- empty; the USING cast below fails loudly rather than quietly if a row of a
-- removed kind ever exists, which is the correct behaviour for a money table.
-- (Deleting such a row is not an option — reject_ledger_mutation() forbids it.)

alter type public.payment_ledger_kind rename to payment_ledger_kind_old;

create type public.payment_ledger_kind as enum (
  'hold', 'stage_release', 'commission', 'penalty', 'refund'
);

alter table public.payment_ledger_entries
  alter column kind type public.payment_ledger_kind
  using kind::text::public.payment_ledger_kind;

drop type public.payment_ledger_kind_old;

-- ---------------------------------------------------------------------------
-- 6. fulfillment_type: services only.
-- ---------------------------------------------------------------------------
-- Dependents: categories.fulfillment_type, bookings.fulfillment_type, three CHECK
-- constraints that name the dying values, and the two functions dropped in step 3
-- that took the enum as an argument. Nothing else.
--
-- The CHECKs must go BEFORE the column type changes: an ALTER COLUMN TYPE rewrites
-- the table and re-validates every constraint on it, and a constraint whose body
-- says 'delivery' cannot be re-validated against a type that no longer has it.

alter table public.categories
  drop constraint if exists categories_delivery_mode_only_for_goods;

alter table public.bookings
  drop constraint if exists bookings_caution_only_on_return;

alter table public.bookings
  drop constraint if exists bookings_delivery_fee_only_on_goods;

-- All 16 seeded categories are already onsite_service or vendor_location_service,
-- and bookings is empty. These two statements are a no-op today and a safety net
-- on any database where that is not true.
update public.categories
   set fulfillment_type = 'onsite_service'
 where fulfillment_type::text in ('delivery', 'delivery_return');

update public.bookings
   set fulfillment_type = 'onsite_service'
 where fulfillment_type::text in ('delivery', 'delivery_return');

alter type public.fulfillment_type rename to fulfillment_type_old;

create type public.fulfillment_type as enum (
  'onsite_service',          -- vendor comes to the venue: check-in (stage 1) -> customer code at the end (stage 2)
  'vendor_location_service'  -- customer comes to the vendor: acceptance (stage 1) -> customer code on completion (stage 2)
);

alter table public.categories
  alter column fulfillment_type type public.fulfillment_type
  using fulfillment_type::text::public.fulfillment_type;

alter table public.bookings
  alter column fulfillment_type type public.fulfillment_type
  using fulfillment_type::text::public.fulfillment_type;

drop type public.fulfillment_type_old;

-- ---------------------------------------------------------------------------
-- 7. delivery_mode: gone with the rider it selected.
-- ---------------------------------------------------------------------------
-- Its only dependent was categories.delivery_mode and the CHECK dropped above.

alter table public.categories
  drop column if exists delivery_mode;

drop type if exists public.delivery_mode;

-- ---------------------------------------------------------------------------
-- 8. Delivery fees and caution fees: gone everywhere.
-- ---------------------------------------------------------------------------
-- Nexa charges no platform delivery fee (a transport vendor prices its own job)
-- and holds no damage deposit (nothing is rented out and returned). The columns
-- have been dead since 0026 forced them to zero; now they leave.

-- The "mark ready for pickup" checkpoint existed only for physical goods.
drop trigger if exists bookings_guard_ready_for_pickup on public.bookings;
drop function if exists public.guard_booking_ready_for_pickup();

alter table public.bookings
  drop column if exists delivery_fee_kobo,
  drop column if exists caution_fee_kobo,
  drop column if exists ready_for_pickup_at;

alter table public.listings
  drop column if exists caution_fee_kobo;

alter table public.payments
  drop column if exists delivery_fee_kobo,
  drop column if exists caution_fee_kobo,
  drop column if exists caution_held_kobo,
  drop column if exists caution_refunded_kobo,
  drop column if exists caution_claimed_kobo;

alter table public.disputes
  drop column if exists is_damage_claim,
  drop column if exists caution_claim_kobo;

-- The re-approval trigger (0006) watched caution_fee_kobo as one of the "core
-- details" whose edit sends a listing back to the queue. Same rule, one field
-- shorter.
create or replace function public.listing_edit_requires_reapproval()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    return new;
  end if;

  if old.status = 'approved' and (
       new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.price_kobo is distinct from old.price_kobo
    or new.price_min_kobo is distinct from old.price_min_kobo
    or new.price_max_kobo is distinct from old.price_max_kobo
    or new.price_type is distinct from old.price_type
    or new.payment_type is distinct from old.payment_type
    or new.category_id is distinct from old.category_id
  ) then
    new.status := 'pending_approval';
    new.approved_at := null;
    new.approved_by := null;
  end if;

  return new;
end;
$$;

-- The end-user write guard (0011) named both fee columns. Referencing a dropped
-- column from a plpgsql body is not a load-time error — it is a runtime error on
-- the next booking update. Rewrite it.
create or replace function public.guard_booking_end_user_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or public.is_admin() then
    return new;
  end if;

  if new.status is distinct from old.status then
    raise exception 'Booking status is advanced by the bookings service, not directly'
      using errcode = 'insufficient_privilege';
  end if;

  if new.agreed_price_kobo is distinct from old.agreed_price_kobo
     or new.commission_percent is distinct from old.commission_percent
     or new.stage_1_release_percent is distinct from old.stage_1_release_percent
     or new.late_penalty_percent_per_30min is distinct from old.late_penalty_percent_per_30min
     or new.stage_1_at is distinct from old.stage_1_at
     or new.stage_2_at is distinct from old.stage_2_at
     or new.completed_at is distinct from old.completed_at
     or new.late_minutes is distinct from old.late_minutes then
    raise exception 'Booking terms and checkpoints are set by the platform, not by a participant'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

-- The flat platform delivery fee is not a number Nexa sets any more, at any value.
-- 0026 zeroed it; a zero is still a fee the Admin Console renders a field for.
delete from public.platform_settings where key = 'delivery_fee_kobo';

-- ---------------------------------------------------------------------------
-- 9. One confirmation code, not two.
-- ---------------------------------------------------------------------------
-- The stage-1 code existed for exactly one fulfillment type — delivery_return,
-- where the customer had to confirm the drop-off as well as the return. A service
-- has one moment the customer confirms: the end of the job. Stage 1 is the
-- vendor's own checkpoint (check-in, or acceptance), which releases the stage-1
-- share and needs no code.
--
-- So: one code, stage 2, minted when the money is actually held.

create or replace function public.mint_confirmation_codes()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'paid_held' and old.status is distinct from 'paid_held' then
    insert into public.booking_confirmation_codes (booking_id, stage)
    values (new.id, 2)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. Vendor subscriptions — the monthly platform fee.
-- ---------------------------------------------------------------------------
-- Nexa's revenue is no longer only a commission on escrow. A vendor pays a
-- monthly fee to be listed. Falling behind on it removes the vendor from the
-- MARKETPLACE, not from Business Studio: they keep their listings, their chat,
-- their bookings in flight, and their money — they simply stop being findable
-- until they pay. Locking a vendor out of the tool they need in order to earn the
-- money they owe you is a good way to never get paid.

-- The fee is a row, not a constant — same rule as commission (0010). Seeded
-- BEFORE the table below, because that table's amount_kobo DEFAULT reads it.
insert into public.platform_settings (key, value, value_type, label, description, min_value, max_value) values
  ('subscription_fee_kobo', '500000'::jsonb, 'money_kobo',
   'Vendor subscription fee (kobo)',
   'What a vendor pays per month to be listed on the marketplace. 500000 kobo = ₦5,000. Changing this sets the price for subscriptions created from now on; existing subscriptions keep the amount_kobo frozen on their row.',
   0, null),

  ('subscription_grace_days', '0'::jsonb, 'number',
   'Subscription grace period (days)',
   'How long after a period ends unpaid before the vendor is marked past_due and drops out of the marketplace. 0 = the day it lapses. The vendor keeps Business Studio access either way.',
   0, 90)
on conflict (key) do nothing;

create type public.subscription_status as enum (
  'trialing',   -- signed up, not yet billed
  'active',     -- paid, inside the current period
  'past_due',   -- period ended unpaid — hidden from the marketplace
  'cancelled'   -- ended, by the vendor or by admin — hidden from the marketplace
);

create table if not exists public.provider_subscriptions (
  provider_id          uuid primary key references public.providers (id) on delete cascade,
  status               public.subscription_status not null default 'trialing',

  -- What this vendor is billed per period, frozen on the row: an admin raising
  -- the platform fee next month must not restate what a vendor already owes.
  -- Defaults to the current setting, so a bootstrap does not have to know it.
  amount_kobo          bigint not null
    default (public.get_setting_numeric('subscription_fee_kobo', 500000))::bigint
    check (amount_kobo >= 0),

  current_period_start timestamptz,
  current_period_end   timestamptz,
  last_paid_at         timestamptz,
  cancelled_at         timestamptz,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists provider_subscriptions_status_idx
  on public.provider_subscriptions (status);

-- The dunning query: who lapses next.
create index if not exists provider_subscriptions_period_end_idx
  on public.provider_subscriptions (current_period_end);

drop trigger if exists provider_subscriptions_set_updated_at on public.provider_subscriptions;
create trigger provider_subscriptions_set_updated_at
  before update on public.provider_subscriptions
  for each row execute function public.set_updated_at();

-- Payment history. Append-only in practice; kept separate from `payments`, which
-- is escrow on a booking and has nothing to do with the platform fee.
create table if not exists public.subscription_payments (
  id                uuid primary key default gen_random_uuid(),
  provider_id       uuid not null references public.providers (id) on delete cascade,
  amount_kobo       bigint not null check (amount_kobo > 0),
  paid_at           timestamptz not null default now(),
  gateway           text,
  gateway_reference text,
  -- Set when an admin records a transfer/cash payment by hand; null when the
  -- gateway webhook wrote the row.
  recorded_by       uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now()
);

create index if not exists subscription_payments_provider_idx
  on public.subscription_payments (provider_id, paid_at desc);

-- A retried webhook must not book the same month's fee twice.
create unique index if not exists subscription_payments_gateway_ref_idx
  on public.subscription_payments (gateway, gateway_reference)
  where gateway_reference is not null;

-- Every provider gets a subscription row, the same way they get a wallet and a
-- reliability row (0004). Without it, "no row" and "not paying" would be the same
-- state, and admin could not see who has never been billed.
create or replace function public.bootstrap_provider_rows()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.provider_reliability (provider_id) values (new.id) on conflict do nothing;
  insert into public.provider_wallets (provider_id) values (new.id) on conflict do nothing;
  insert into public.provider_subscriptions (provider_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

insert into public.provider_subscriptions (provider_id)
select p.id from public.providers p
on conflict (provider_id) do nothing;

-- The one question the marketplace asks: may this vendor be found?
--
-- No row means a vendor who predates billing, or one the bootstrap has not caught
-- yet — they stay visible. Only an explicit past_due or cancelled hides them, so
-- a bug in the billing job cannot empty the marketplace.
--
-- SECURITY DEFINER because the caller is usually `anon` browsing listings, and
-- anon has no read on provider_subscriptions and must not get one.
create or replace function public.provider_is_listable(p_provider_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.provider_subscriptions s
    where s.provider_id = p_provider_id
      and s.status in ('past_due', 'cancelled')
  );
$$;

grant execute on function public.provider_is_listable(uuid) to anon, authenticated;

-- Marketplace reads go through RLS, so RLS is where the hiding belongs. A
-- lapsed vendor's listings disappear from every public read path at once —
-- search, category pages, the provider profile, a direct link — without a single
-- application query having to remember to filter.
--
-- listings_manage_own is untouched: Business Studio still sees everything.
drop policy if exists listings_public_read on public.listings;

create policy listings_public_read on public.listings
  for select to anon, authenticated
  using (
    status = 'approved'
    and exists (
      select 1 from public.providers p
      where p.id = listings.provider_id and p.status = 'approved'
    )
    and public.provider_is_listable(listings.provider_id)
  );

drop policy if exists listing_media_public_read on public.listing_media;

create policy listing_media_public_read on public.listing_media
  for select to anon, authenticated
  using (
    status = 'approved'
    and exists (
      select 1 from public.listings l
      join public.providers p on p.id = l.provider_id
      where l.id = listing_media.listing_id
        and l.status = 'approved'
        and p.status = 'approved'
        and public.provider_is_listable(p.id)
    )
  );

-- RLS, in the style of 0011/0024: admin sees and writes everything; a vendor
-- reads their own subscription and their own receipts, and writes neither. Money
-- state is written by the billing service on the service role, which bypasses RLS.

alter table public.provider_subscriptions enable row level security;
alter table public.subscription_payments  enable row level security;

create policy admin_all on public.provider_subscriptions
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy admin_all on public.subscription_payments
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy provider_subscriptions_read_own on public.provider_subscriptions
  for select to authenticated
  using (provider_id = public.my_provider_id());

create policy subscription_payments_read_own on public.subscription_payments
  for select to authenticated
  using (provider_id = public.my_provider_id());

-- 0011's blanket grant ran once, on the tables that existed then. New tables need
-- their own. Not granted to anon: a vendor's billing state is nobody else's read.
grant select, insert, update, delete on public.provider_subscriptions to authenticated;
grant select, insert, update, delete on public.subscription_payments  to authenticated;

-- ---------------------------------------------------------------------------
-- 11. Staff roles: no riders, and no product/service split.
-- ---------------------------------------------------------------------------
-- 'rider_operations' manages a pool that no longer exists. 'product_vendor_manager'
-- and 'service_vendor_manager' split a distinction that no longer exists either —
-- every vendor sells a service now. All three collapse into one vendor_manager.
--
-- Dependent on the enum: staff_members.staff_role (and its index, which the type
-- change rebuilds). is_super_admin() only names 'super_admin' inside its body, so
-- it needs no change and holds no dependency.

alter type public.staff_role rename to staff_role_old;

create type public.staff_role as enum (
  'super_admin',
  'vendor_manager',
  'customer_support',
  'finance',
  'marketing'
);

alter table public.staff_members
  alter column staff_role type public.staff_role
  using (
    case staff_role::text
      when 'rider_operations'       then 'vendor_manager'
      when 'service_vendor_manager' then 'vendor_manager'
      when 'product_vendor_manager' then 'vendor_manager'
      else staff_role::text
    end
  )::public.staff_role;

drop type public.staff_role_old;

-- The role is only a default bundle (0024); the effective permissions live in the
-- array. Strip the rider keys from it wherever an admin already granted them.
update public.staff_members
   set permissions = coalesce(
         (select array_agg(p order by p)
            from unnest(permissions) as p
           where p not in ('riders.view', 'riders.verify', 'riders.suspend', 'riders.reassign')),
         '{}'::text[]
       )
 where permissions && array['riders.view', 'riders.verify', 'riders.suspend', 'riders.reassign']::text[];

-- ---------------------------------------------------------------------------
-- 12. Feature flags.
-- ---------------------------------------------------------------------------
-- A flag is a switch on something that exists. These four now switch nothing:
--   rider_delivery    — the rider pool is gone (this migration).
--   caution_fee       — the caution columns are gone (step 8).
--   in_app_calling    — superseded by the WhatsApp relay (0027).
--   event_stand_mode  — walk-up product selling; not a services marketplace.
-- Leaving a dead flag in the table is worse than deleting it: it invites someone
-- to turn it on.
--
-- Kept: plan_my_event, public_reliability_score, coupons, referrals (all real,
-- all still off), plus negotiable_pricing and contact_info_flagging, which are
-- live and load-bearing.

delete from public.feature_flags
 where key in ('rider_delivery', 'caution_fee', 'in_app_calling', 'event_stand_mode');

-- 0027 inserts this row without a label, and feature_flags.label is NOT NULL — so
-- on a fresh database that statement is a hard error. Insert it properly here and
-- make it idempotent on the live database, where the row already exists.
insert into public.feature_flags (key, enabled, label, description) values
  ('whatsapp_mediated_chat', false,
   'WhatsApp-mediated chat',
   'Routes customer and vendor WhatsApp messages through Nexa so neither side sees the other''s number and the escrow record stays visible to Admin. Nexa remains the system of record for chat.')
on conflict (key) do update
  set label = excluded.label,
      description = excluded.description;

-- ---------------------------------------------------------------------------
-- 13. Booking terms and pricing, on the services model.
-- ---------------------------------------------------------------------------
-- resolve_booking_terms (0010) read the provider's agreement and returned nothing
-- at all when there wasn't one — which made guard_booking_insert_terms (0011)
-- refuse the booking outright. That was right when every vendor signed a
-- negotiated commission agreement before going live. It is wrong now: a vendor's
-- commercial relationship with Nexa is the subscription, and the agreement is an
-- optional per-vendor override on top of the platform defaults.
--
-- So the function always returns exactly one row: the override where one exists,
-- the platform setting where it does not.

create or replace function public.resolve_booking_terms(p_provider_id uuid)
returns table (
  commission_percent numeric,
  stage_1_release_percent numeric,
  late_penalty_percent_per_30min numeric,
  deposit_percent numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(a.commission_percent_override,
             public.get_setting_numeric('commission_percent', 10)),
    coalesce(a.stage_1_release_percent_override,
             public.get_setting_numeric('stage_1_release_percent', 50)),
    coalesce(a.late_penalty_percent_per_30min_override,
             public.get_setting_numeric('late_penalty_percent_per_30min', 1)),
    coalesce(a.deposit_percent,
             public.get_setting_numeric('deposit_percent_min', 10))
  from (select 1) as one_row
  left join public.provider_agreements a
    on a.provider_id = p_provider_id
   and a.is_active
  limit 1;
$$;

-- Pricing a booking, with the last of the product era taken out: no delivery fee
-- (a transport vendor prices its own job into its listing) and no caution fee
-- (nothing is rented out and returned). What remains is what a service booking
-- actually needs: the listing must be bookable, and the price must come from the
-- listing or from an accepted offer — never from the client.
create or replace function public.price_booking_from_listing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  l record;
  cat record;
  offer record;
  is_end_user boolean := (select auth.uid()) is not null and not public.is_admin();
begin
  select * into l from public.listings where id = new.listing_id;
  if not found then
    raise exception 'No such listing' using errcode = 'foreign_key_violation';
  end if;

  select * into cat from public.categories where id = l.category_id;

  if is_end_user then
    if l.status <> 'approved' then
      raise exception 'That listing is not available' using errcode = 'check_violation';
    end if;
    if not exists (select 1 from public.providers p
                   where p.id = l.provider_id and p.status = 'approved') then
      raise exception 'That provider is not available' using errcode = 'check_violation';
    end if;
    -- A vendor hidden from the marketplace for non-payment cannot be booked
    -- through a stale link either.
    if not public.provider_is_listable(l.provider_id) then
      raise exception 'That provider is not available' using errcode = 'check_violation';
    end if;
    if l.provider_id <> new.provider_id then
      raise exception 'Listing does not belong to that provider' using errcode = 'check_violation';
    end if;
  end if;

  -- Copied from the category and frozen: a category retyped next month must not
  -- rewrite how a booking already in flight releases money.
  new.fulfillment_type := cat.fulfillment_type;

  if is_end_user then
    if l.price_type = 'fixed' then
      new.agreed_price_kobo := l.price_kobo;
    else
      -- Section 08: a negotiable booking exists only at an agreed number.
      select * into offer
        from public.price_offers
       where listing_id = l.id
         and customer_id = new.customer_id
         and status = 'accepted'
       limit 1;

      if not found then
        raise exception 'This listing is priced on request. Agree a price in chat first.'
          using errcode = 'check_violation';
      end if;

      new.agreed_price_kobo := offer.amount_kobo;
    end if;
  end if;

  return new;
end;
$$;


-- ---------------------------------------------------------------------------
-- 14. The last of the rider era.
--
-- These columns and this table only ever existed to serve a Nexa-operated rider
-- pool and an in-app calling screen. Transport is now an ordinary vendor
-- category, and all conversation is mediated over WhatsApp, so nothing reads
-- them any more.
-- ---------------------------------------------------------------------------

-- Vehicle-class matching: a provider "called a bike/car/van" for a load. Gone.
alter table public.listings drop column if exists requires_large_vehicle;
alter table public.bookings drop column if exists requires_large_vehicle;

-- In-app masked calling. Superseded by the WhatsApp relay, which masks both
-- sides the same way without Nexa running a voice proxy.
drop table if exists public.call_sessions;
drop type if exists public.call_status;
