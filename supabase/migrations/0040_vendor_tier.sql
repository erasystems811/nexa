-- Self-serve vendors vs. paid providers.
--
-- Nexa has three kinds of "vendor" in practice, only two of which are paid
-- through Nexa's escrow:
--   1. self_serve   — food/ice-cream/popsicle sellers etc, invited to come sell
--                      directly to guests at the event. The host pays them
--                      nothing through Nexa — no booking, no escrow, no money
--                      through the platform at all.
--   2. paid_service  — cake, catering, rentals (chairs, canopy, light, sound,
--                      flowers, cars) — paid through escrow, as today.
--   3. paid_performer — DJs, hypemen, dancers, drummers — also paid through
--                      escrow, as today.
--
-- Tiers 2 and 3 behave identically at runtime — the split exists for labelling
-- (badges, filtering, future analytics), not because Nexa treats their money
-- differently. Only tier 1 changes behavior: a self-serve listing never
-- creates a booking row, so none of the booking/payment machinery
-- (fulfillment_type, the booking state machine, price_booking_from_listing())
-- needs to know this enum exists.
create type public.vendor_tier as enum ('self_serve', 'paid_service', 'paid_performer');

alter table public.categories
  add column vendor_tier public.vendor_tier not null default 'paid_service';

-- Retag the real, live-seeded categories. These are not in any migration —
-- the 16 rows were inserted directly against the database (see 0028's own
-- comment) — so this updates by slug rather than assuming rows exist here.
update public.categories set vendor_tier = 'paid_performer' where slug in ('djs-mcs', 'live-performers');

-- Seed one real self-serve category so the tier has something to point at —
-- none of the 16 seeded categories are informal show-up-and-sell food
-- vendors (catering/cakes are full paid catering, not this).
insert into public.categories (slug, name, description, fulfillment_type, vendor_tier, sort_order, is_active)
select 'self-serve-food', 'Food & Snack Vendors', 'Come sell directly to guests at the event — not paid through Nexa.',
       'onsite_service', 'self_serve', coalesce((select max(sort_order) from public.categories), 0) + 1, true
where not exists (select 1 from public.categories where slug = 'self-serve-food');
