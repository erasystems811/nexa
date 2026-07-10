-- 0001_foundation.sql
-- Extensions, enums, and shared helpers.
--
-- Money is stored in kobo (bigint), never as float. `naira_amount * 100`.
-- Percentages are stored as numeric(5,2) meaning "12.50" = 12.5%.

create extension if not exists "pgcrypto" with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

-- PRD Section 03. Four roles, four surfaces.
create type public.user_role as enum ('admin', 'provider', 'customer', 'rider');

-- PRD Section 10. Set on the Category; determines the payment checkpoint pair
-- and whether a rider is ever involved.
create type public.fulfillment_type as enum (
  'delivery',                 -- rider picks up (stage 1) -> customer code on drop-off (stage 2)
  'delivery_return',          -- customer code #1 on drop-off (stage 1) -> customer code #2 on return (stage 2)
  'onsite_service',           -- provider checks in at venue (stage 1) -> customer code at end (stage 2)
  'vendor_location_service'   -- provider accepts (stage 1) -> customer code on arrival (stage 2)
);

-- PRD Section 17: rider assignment exists from Phase 1, but a category with no
-- registered riders yet falls back to provider delivery without a rebuild.
create type public.delivery_mode as enum ('rider', 'provider');

create type public.verification_status as enum (
  'pending', 'approved', 'rejected', 'changes_requested', 'suspended', 'removed'
);

create type public.vehicle_type as enum ('bike', 'car', 'van');

create type public.listing_status as enum (
  'draft', 'pending_approval', 'approved', 'rejected', 'changes_requested', 'paused', 'hidden'
);

-- PRD Section 08.
create type public.price_type as enum ('fixed', 'negotiable');

-- PRD Section 06.
create type public.payment_type as enum ('full', 'deposit');

-- PRD Section 09 (booking lifecycle table).
create type public.booking_status as enum (
  'pending', 'accepted', 'rejected', 'paid_held', 'in_progress',
  'completed', 'cancelled', 'disputed'
);

create type public.payment_status as enum (
  'pending', 'held', 'partially_released', 'released',
  'refunded', 'partially_refunded', 'failed'
);

create type public.payment_ledger_kind as enum (
  'hold', 'stage_release', 'commission', 'penalty', 'refund',
  'caution_hold', 'caution_refund', 'caution_claim', 'rider_payout'
);

create type public.dispute_status as enum ('open', 'under_review', 'resolved', 'rejected');

create type public.rider_assignment_status as enum (
  'assigned', 'accepted', 'declined', 'picked_up', 'en_route', 'delivered', 'returned', 'cancelled'
);

create type public.event_project_status as enum ('draft', 'active', 'completed', 'cancelled');

create type public.moderation_flag_reason as enum ('phone_number', 'bank_account', 'off_platform_solicitation');

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Generates the customer-facing confirmation code. Short enough to read aloud
-- over noise at a venue, large enough that guessing is not practical
-- (32^6 ≈ 1.07e9), and excludes the ambiguous 0/O/1/I/L characters.
create or replace function public.generate_confirmation_code()
returns text
language plpgsql
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  result text := '';
  i integer;
begin
  for i in 1..6 loop
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return result;
end;
$$;
