-- Two small housekeeping changes the owner asked for.
--
-- 1. Coupons off the menu. It was a placeholder flag for a feature that does not
--    exist and is not planned for now (0012 seeded it "out of scope for V1").
--    Sitting in the Admin settings it only invited the question "what is this?"
--    Deleting the flag row is what removes it from the console — the settings
--    page lists whatever rows exist. If coupons is ever built, it comes back with
--    its own migration.
--
-- 2. The subscription fee reads in Naira, not kobo. The amount is still stored in
--    kobo — every price in Nexa is — but the label no longer says "(kobo)", so the
--    Admin box (which now takes Naira) and the label agree.

delete from public.feature_flags where key = 'coupons';

update public.platform_settings
  set label = 'Vendor subscription fee'
  where key = 'subscription_fee_kobo';
