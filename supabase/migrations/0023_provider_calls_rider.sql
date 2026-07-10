-- 0023_provider_calls_rider.sql
--
-- Founder change to the delivery model: the provider chooses a rider by pressing
-- "Call a bike / car / van", rather than Nexa auto-assigning on mark-ready. The
-- riders are still Nexa-registered and verified — the provider picks the vehicle
-- class, not a stranger. This overrides the PRD's "the provider never arranges
-- their own delivery" (Sections 07, 13, 20); riders remain a Nexa-operated pool.

-- The auto-assignment trigger goes away — assignment is now provider-initiated.
drop trigger if exists bookings_assign_outbound_rider on public.bookings;

-- Picks a registered, approved rider of a specific vehicle class in the
-- provider's city, least-loaded first. Excludes riders already tried on this
-- booking (e.g. one who declined). Null when none of that class is free.
create or replace function public.pick_rider_by_vehicle(
  p_provider_id uuid,
  p_vehicle public.vehicle_type,
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
    and r.vehicle_type = p_vehicle
    and (r.city_id = p.city_id or p.city_id is null)
    and not (r.id = any (p_exclude))
  order by
    (select count(*) from public.rider_assignments ra
      where ra.rider_id = r.id
        and ra.status in ('assigned','accepted','picked_up','en_route','arrived'))
  limit 1;
$$;
