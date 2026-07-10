-- 0017_booking_reference_default.sql
--
-- `bookings.reference` is NOT NULL and filled by the assign_booking_reference
-- trigger, but the column had no DEFAULT. That is invisible in SQL (the trigger
-- runs first) and wrong everywhere else: generated types marked `reference` as a
-- required insert column, so every caller had to invent a value the trigger
-- then threw away.

alter table public.bookings alter column reference set default '';
