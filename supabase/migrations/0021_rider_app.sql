-- 0021_rider_app.sql
-- Rider App. PRD Section 15.
--
-- Riders and their assignments, reliability, and wallets already exist (0005).
-- This adds: a vehicle-size signal for matching, the auto-assignment that turns
-- a provider's "mark ready" into a queued delivery, and the fee-share record.

-- ---------------------------------------------------------------------------
-- 1. Vehicle-size matching. PRD Section 15:
--    "bulk or large orders ... are matched to riders with cars or vans, not bikes."
-- ---------------------------------------------------------------------------

alter table public.listings
  add column requires_large_vehicle boolean not null default false;

alter table public.bookings
  add column requires_large_vehicle boolean not null default false;

-- Copy the flag onto the booking at creation, alongside the other frozen fields.
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
  new.requires_large_vehicle := l.requires_large_vehicle;

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

    if cat.fulfillment_type in ('delivery', 'delivery_return') then
      new.delivery_fee_kobo := public.get_setting_numeric('delivery_fee_kobo', 150000)::bigint;
    else
      new.delivery_fee_kobo := 0;
    end if;

    if cat.fulfillment_type = 'delivery_return' and public.is_feature_enabled('caution_fee') then
      new.caution_fee_kobo := l.caution_fee_kobo;
    else
      new.caution_fee_kobo := 0;
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Turn "mark ready for pickup" into a queued delivery. PRD Section 13/15:
--    the provider marks ready, and Nexa assigns a rider — the provider never
--    arranges delivery.
-- ---------------------------------------------------------------------------

-- Picks one eligible rider: approved, in the provider's city, with a vehicle
-- that fits. A bulk order excludes bikes (Section 15). Returns null when nobody
-- fits, in which case no assignment is created and Admin assigns manually later
-- (Section 12) — the booking waits rather than going to an unsuitable rider.
create or replace function public.pick_delivery_rider(
  p_provider_id uuid,
  p_requires_large boolean,
  p_exclude uuid[] default '{}'
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select r.id
  from public.riders r
  join public.providers p on p.id = p_provider_id
  where r.status = 'approved'
    and (r.city_id = p.city_id or p.city_id is null)
    and (not p_requires_large or r.vehicle_type in ('car', 'van'))
    and not (r.id = any (p_exclude))
  order by
    -- Prefer the smallest sufficient vehicle, then the least-loaded rider.
    case r.vehicle_type when 'bike' then 0 when 'car' then 1 else 2 end,
    (select count(*) from public.rider_assignments ra
      where ra.rider_id = r.id and ra.status in ('assigned','accepted','picked_up','en_route','arrived'))
  limit 1;
$$;

-- The delivery-fee split. PRD Section 10: delivery-only pays the full fee on the
-- delivery code; delivery + return pays half on drop-off, half on return.
create or replace function public.rider_leg_fee(
  p_delivery_fee bigint, p_fulfillment public.fulfillment_type, p_leg smallint
)
returns bigint
language sql
immutable
as $$
  select case
    when p_fulfillment = 'delivery' then p_delivery_fee
    when p_leg = 1 then round(p_delivery_fee / 2.0)          -- drop-off half
    else p_delivery_fee - round(p_delivery_fee / 2.0)         -- return remainder
  end;
$$;

create or replace function public.assign_outbound_rider()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  chosen uuid;
begin
  if new.ready_for_pickup_at is null or old.ready_for_pickup_at is not null then
    return new;
  end if;
  if new.fulfillment_type not in ('delivery', 'delivery_return') then
    return new;
  end if;
  -- With rider delivery off, a category falls back to provider delivery
  -- (Section 17). No rider assignment is created; nothing here runs.
  if not public.is_feature_enabled('rider_delivery') then
    return new;
  end if;

  chosen := public.pick_delivery_rider(new.provider_id, new.requires_large_vehicle);
  if chosen is null then
    return new;  -- Admin will assign manually.
  end if;

  insert into public.rider_assignments (booking_id, rider_id, leg, status, fee_share_kobo)
  values (
    new.id, chosen, 1, 'assigned',
    public.rider_leg_fee(new.delivery_fee_kobo, new.fulfillment_type, 1)
  )
  on conflict (booking_id, rider_id, leg) do nothing;

  return new;
end;
$$;

create trigger bookings_assign_outbound_rider
  after update of ready_for_pickup_at on public.bookings
  for each row execute function public.assign_outbound_rider();

-- ---------------------------------------------------------------------------
-- 3. Riders are a private directory. A rider reads their own row; nobody else
--    browses them. (Providers/customers already had no rider read policy.)
--    Confirm the apply + read policies from 0011 are what we rely on — no change
--    needed here, noted for the reviewer.
-- ---------------------------------------------------------------------------

-- 0011 gave: riders_read_own, riders_apply, riders_update_own,
-- rider_documents_read_own/submit, rider_reliability_read_own,
-- rider_wallets_read_own/update_own, rider_assignments_read/update_own.
-- The rider-facing app runs entirely within those. The delivery *actions* that
-- move money run on the service role from the bookings/payments/rider services,
-- because releasing a payout requires reading a bank account no end-user may see.
