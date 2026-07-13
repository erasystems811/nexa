-- 0025_v12_deprecate_rider_network.sql
-- Addendum v1.2: Nexa no longer operates a registered rider pool.
-- Transport/logistics businesses are ordinary providers under marketplace
-- categories. Keep the legacy rider tables for history/migration, but make the
-- old feature flag unambiguously off so no new work depends on it.

update public.feature_flags
   set enabled = false,
       label = 'Legacy rider delivery',
       description = 'Deprecated by PRD Addendum v1.2. Transport/logistics companies now list as providers; Nexa no longer operates a separate rider pool.'
 where key = 'rider_delivery';

update public.feature_flags
   set enabled = false,
       label = 'Legacy caution fee on rentals',
       description = 'Legacy flow tied to Delivery + Return bookings. Revisit as provider-owned rental terms or Plan Your Event managed-service terms under Addendum v1.2.'
 where key = 'caution_fee';