-- Nexa does not compute anybody's cut.
--
-- The platform had four percentages doing arithmetic on other people's money:
-- a commission percent, a deposit/stage-1 release percent, a late-penalty
-- percent, and a customer/platform split of that penalty. Every one of them was
-- a rule the code applied automatically, and between them they made a simple
-- idea — Nexa holds the money until the job is done — hard to explain and hard
-- to trust.
--
-- The idea is now exactly as simple as it sounds:
--
--   the customer pays  ->  Nexa holds the whole amount  ->  the job is done  ->
--   Nexa releases it, in full or in part, when Nexa decides to.
--
-- The release amount is chosen by a person, at the time, in the Admin Console.
-- Nothing is deducted, split, or scheduled by a formula. What Nexa keeps, if
-- anything, is whatever it does not release — a decision, not a calculation.

-- ---------------------------------------------------------------------------
-- 1. Stop stamping percentages onto bookings.
-- ---------------------------------------------------------------------------
-- bookings_price_from_listing still sets the price and the fulfillment type from
-- the listing. Only the terms trigger goes: there are no terms left to resolve.
drop trigger if exists bookings_guard_insert_terms on public.bookings;
drop function if exists public.guard_booking_insert_terms();
drop function if exists public.resolve_booking_terms(uuid);

-- ---------------------------------------------------------------------------
-- 2. The guard must stop naming columns that are about to not exist.
-- ---------------------------------------------------------------------------
-- A participant still cannot move their own booking's status or price. There is
-- simply less to protect now.
create or replace function public.guard_booking_end_user_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if new.status is distinct from old.status then
    raise exception 'Booking status is advanced by the bookings service, not directly'
      using errcode = 'insufficient_privilege';
  end if;

  if new.agreed_price_kobo is distinct from old.agreed_price_kobo
     or new.stage_2_at is distinct from old.stage_2_at
     or new.completed_at is distinct from old.completed_at then
    raise exception 'Booking terms and checkpoints are set by the platform, not by a participant'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Drop the percentage columns.
-- ---------------------------------------------------------------------------
alter table public.bookings
  drop column if exists commission_percent,
  drop column if exists stage_1_release_percent,
  drop column if exists late_penalty_percent_per_30min,
  drop column if exists late_minutes,
  drop column if exists stage_1_at,
  drop column if exists provider_arrived_at;

alter table public.payments
  drop column if exists commission_kobo,
  drop column if exists penalty_kobo,
  drop column if exists stage_1_released_at,
  drop column if exists stage_2_released_at;

-- The penalty machinery, whole.
drop table if exists public.penalty_applications;

-- provider_agreements existed only to carry a vendor's negotiated percentages.
-- With no percentages there is nothing to agree, so the table is not "empty" —
-- it is meaningless, and an empty table invites someone to fill it back in.
drop table if exists public.provider_agreements;

-- ---------------------------------------------------------------------------
-- 4. The ledger records money moving. Nothing else.
-- ---------------------------------------------------------------------------
-- 'commission' and 'penalty' described deductions Nexa no longer makes. Postgres
-- cannot drop an enum value, so the type is rebuilt and every dependent column
-- recast. There are no ledger rows, so nothing can fail the cast.
alter type public.payment_ledger_kind rename to payment_ledger_kind_old;

create type public.payment_ledger_kind as enum ('hold', 'stage_release', 'refund');

alter table public.payment_ledger_entries
  alter column kind type public.payment_ledger_kind
  using kind::text::public.payment_ledger_kind;

drop type public.payment_ledger_kind_old;

-- ---------------------------------------------------------------------------
-- 5. Retire the settings that only existed to feed the formulas.
-- ---------------------------------------------------------------------------
delete from public.platform_settings
 where key in (
   'commission_percent',
   'deposit_percent_min',
   'deposit_percent_max',
   'late_penalty_percent_per_30min',
   'penalty_customer_share_percent'
 );
