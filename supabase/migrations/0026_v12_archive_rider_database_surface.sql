-- 0026_v12_archive_rider_database_surface.sql
-- Addendum v1.2: finish archiving the old Nexa-operated rider network at the
-- database behavior layer without dropping historical tables. Transport,
-- logistics, car, van, bus, and truck companies are providers now.

-- New marketplace bookings must not add a Nexa-owned delivery fee or platform
-- caution fee. Delivery/setup/transport terms are provider-owned listing or
-- quote terms unless the booking is inside a future Plan Your Event flow.
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
    if l.provider_id <> new.provider_id then
      raise exception 'Listing does not belong to that provider' using errcode = 'check_violation';
    end if;
  end if;

  new.fulfillment_type := cat.fulfillment_type;

  if is_end_user then
    if l.price_type = 'fixed' then
      new.agreed_price_kobo := l.price_kobo;
    else
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

    -- v1.2: Nexa does not operate delivery/rider fulfillment. These columns stay
    -- for legacy data and future migration only.
    new.delivery_fee_kobo := 0;
    new.caution_fee_kobo := 0;
  end if;

  return new;
end;
$$;

-- Make old rider entry points fail loudly if called by legacy code or RPC.
drop trigger if exists bookings_assign_outbound_rider on public.bookings;

create or replace function public.assign_outbound_rider()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Nexa rider assignment is deprecated by PRD Addendum v1.2; use provider-owned fulfillment.'
    using errcode = 'feature_not_supported';
end;
$$;

create or replace function public.pick_delivery_rider(
  p_provider_id uuid,
  p_requires_large boolean,
  p_exclude uuid[] default '{}'
)
returns uuid
language plpgsql
as $$
begin
  raise exception 'Nexa rider assignment is deprecated by PRD Addendum v1.2; transport/logistics companies are providers.'
    using errcode = 'feature_not_supported';
end;
$$;

create or replace function public.pick_rider_by_vehicle(
  p_provider_id uuid,
  p_vehicle public.vehicle_type,
  p_exclude uuid[] default '{}'
)
returns uuid
language plpgsql
as $$
begin
  raise exception 'Nexa rider assignment is deprecated by PRD Addendum v1.2; transport/logistics companies are providers.'
    using errcode = 'feature_not_supported';
end;
$$;

create or replace function public.rider_leg_fee(
  p_delivery_fee bigint,
  p_fulfillment public.fulfillment_type,
  p_leg smallint
)
returns bigint
language plpgsql
as $$
begin
  raise exception 'Nexa rider payouts are deprecated by PRD Addendum v1.2.'
    using errcode = 'feature_not_supported';
end;
$$;

-- Keep old rider rows for history, but stop status changes from promoting users
-- into the rider role. Existing rider-role profiles should be manually reviewed
-- and moved to provider/customer as part of data migration.
create or replace function public.sync_rider_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  return new;
end;
$$;

update public.feature_flags
   set enabled = false,
       label = 'Archived rider delivery',
       description = 'Archived by PRD Addendum v1.2. Transport/logistics companies now list as providers; the rider pool is no longer a product surface.'
 where key = 'rider_delivery';

update public.platform_settings
   set value = '0'::jsonb,
       label = 'Legacy delivery fee (archived)',
       description = 'Archived by PRD Addendum v1.2. Marketplace delivery/setup/transport terms now belong to provider listings or quotes; Nexa does not add a platform delivery fee.'
 where key = 'delivery_fee_kobo';