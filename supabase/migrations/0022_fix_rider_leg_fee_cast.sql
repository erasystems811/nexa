-- 0022_fix_rider_leg_fee_cast.sql
--
-- Bug found by the Rider App end-to-end test: marking a goods booking ready
-- threw "function public.rider_leg_fee(bigint, fulfillment_type, integer) does
-- not exist", which aborted the update and created no assignment.
--
-- rider_leg_fee's third parameter is smallint, but the trigger passed the
-- integer literal 1. Postgres does not implicitly narrow integer -> smallint
-- during function resolution, so the call did not match. Cast the leg literal.

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
  if not public.is_feature_enabled('rider_delivery') then
    return new;
  end if;

  chosen := public.pick_delivery_rider(new.provider_id, new.requires_large_vehicle);
  if chosen is null then
    return new;
  end if;

  insert into public.rider_assignments (booking_id, rider_id, leg, status, fee_share_kobo)
  values (
    new.id, chosen, 1, 'assigned',
    public.rider_leg_fee(new.delivery_fee_kobo, new.fulfillment_type, 1::smallint)
  )
  on conflict (booking_id, rider_id, leg) do nothing;

  return new;
end;
$$;
