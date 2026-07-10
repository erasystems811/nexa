-- 0020_rider_arrived_status.sql
-- Adds the 'arrived' step to the delivery flow: picked up -> en route -> arrived
-- -> delivered (PRD Section 15). In its own migration because Postgres forbids
-- using a new enum value in the same transaction that adds it.

alter type public.rider_assignment_status add value if not exists 'arrived' after 'en_route';
