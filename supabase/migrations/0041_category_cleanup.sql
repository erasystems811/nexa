-- Category cleanup, per Chidera's direction 2026-08-16.
--
-- - "Food & Snack Vendors" (the self-serve tier's only category so far) is
--   too narrow a name for what it actually covers — renamed to "Event
--   Vendor". Still self_serve: not paid through Nexa.
-- - "Sound & Lighting" was one category for two different kinds of vendor
--   (a sound engineer and a lighting rig are not the same booking) — split
--   into "Sound" and "Lighting".
-- - Event Staff & Ushers, Security, Cleaning, and Event Planning &
--   Coordination are deactivated, not deleted — same reasoning as 0034
--   (makeup-styling): a category is referenced by provider_categories and
--   listings, so deleting one that ever had either would fail the foreign
--   key or pull a vendor's chosen category out from under them. is_active =
--   false removes it from the homepage/search/apply-form/admin list at once.
-- - Makeup & Styling, already deactivated by 0034, is now removed completely
--   (deleted, not just deactivated) — there is nothing referencing it, so
--   there's no orphaning risk.

update public.categories set name = 'Event Vendor', slug = 'event-vendor' where slug = 'self-serve-food';

update public.categories set name = 'Sound', slug = 'sound' where slug = 'sound-lighting';

insert into public.categories (slug, name, description, fulfillment_type, vendor_tier, sort_order, is_active)
select 'lighting', 'Lighting', 'Lighting for events.', 'onsite_service', 'paid_service',
       coalesce((select max(sort_order) from public.categories), 0) + 1, true
where not exists (select 1 from public.categories where slug = 'lighting');

update public.categories set is_active = false
  where slug in ('event-staff', 'security', 'cleaning', 'event-planning');

delete from public.categories where slug = 'makeup-styling';
