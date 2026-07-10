-- 0012_seed_settings.sql
-- Seeds ONLY platform settings and feature flags.
--
-- Deliberately absent: categories, cities, providers, event types. PRD Section 01
-- ("no fixed launch category list") and Section 17 ("no hardcoded categories,
-- providers, or cities"). Admin creates the first city and the first category
-- when the first verified provider is onboarded. Seeding "Abuja" here would be
-- the exact hardcoding the PRD forbids, even though Abuja is the launch city.

insert into public.platform_settings (key, value, value_type, label, description, min_value, max_value) values
  ('commission_percent', '10'::jsonb, 'percent',
   'Platform commission (%)',
   'Nexa''s cut of each booking. PRD Section 10: editable at any time, never a code deployment. A provider agreement may override this per provider.',
   0, 100),

  ('stage_1_release_percent', '50'::jsonb, 'percent',
   'Stage-1 release (%)',
   'Share of the provider payout released at the stage-1 checkpoint (rider pickup, provider check-in, or booking acceptance, depending on fulfillment type). The remainder releases on the customer''s stage-2 confirmation code. Set to 0 for single-release-on-completion.',
   0, 100),

  ('delivery_fee_kobo', '150000'::jsonb, 'money_kobo',
   'Flat delivery fee (kobo)',
   'Set by Nexa, not by providers, so providers cannot quietly price out riders. PRD Section 10: V1 is a flat fee; distance-based pricing is Phase 2+. 150000 kobo = ₦1,500.',
   0, null),

  ('deposit_percent_min', '10'::jsonb, 'percent',
   'Minimum deposit (%)',
   'Lower bound of the range a per-provider deposit percentage must fall within. There is no platform-wide deposit default (PRD Section 20) — only this range.',
   0, 100),

  ('deposit_percent_max', '70'::jsonb, 'percent',
   'Maximum deposit (%)',
   'Upper bound of the per-provider negotiated deposit percentage.',
   0, 100),

  ('late_penalty_percent_per_30min', '1'::jsonb, 'percent',
   'Late-arrival penalty (% per 30 min)',
   'Standard Provider Agreement default (PRD Section 10). Admin can record a per-provider override on the agreement.',
   0, 100),

  ('penalty_customer_share_percent', '30'::jsonb, 'percent',
   'Penalty share to customer (%)',
   'Of penalty money collected, this share is passed to the affected customer as compensation; the rest is retained by Nexa. PRD Section 10: 30/70.',
   0, 100),

  ('payout_schedule_days', '7'::jsonb, 'number',
   'Payout schedule (days)',
   'How long completed earnings sit as pending before settling, giving Admin a window to catch disputes before money leaves the platform. PRD Section 10.',
   0, 90),

  ('provider_probation_bookings', '3'::jsonb, 'number',
   'Probation bookings',
   'A newly approved provider''s first N bookings receive closer Admin attention. PRD Section 05.',
   0, 20),

  ('cancellation_free_window_hours', '0'::jsonb, 'number',
   'Free-cancellation window after acceptance (hours)',
   'Before provider acceptance a customer always gets a full refund. After acceptance, the provider''s own tiered policy applies. This setting is an optional grace period on top.',
   0, 168)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Feature flags — PRD Section 17 / 18.
--
-- Everything whose schema exists but whose UI is not Phase 1 defaults to OFF.
-- Turning one on is an UPDATE on this table. It is never a migration, and it is
-- never a redeploy.
-- ---------------------------------------------------------------------------

insert into public.feature_flags (key, enabled, label, description, enabled_for_roles) values
  ('plan_my_event', false,
   'Plan My Event',
   'Guided event flow, bundles, and the Event Project dashboard. Schema (event_projects, event_project_checklist_items, bookings.event_project_id) ships in Phase 1; the entry point stays behind "Coming Soon" until Phase 2. PRD Section 17, 19.',
   null),

  ('public_reliability_score', false,
   'Public reliability score',
   'Displays the computed reliability score on public provider profiles. Data collection starts at a provider''s first booking regardless of this flag. Turning this on exposes only providers whose own is_publicly_visible switch is also set. PRD Section 17, 18.',
   null),

  ('event_stand_mode', false,
   'Event Stand Mode',
   'Live walk-up vendor selling with QR checkout. Genuinely new work in Phase 2, not just an exposure flag — this row exists so the surface can be dark-launched. PRD Section 18, 19.',
   null),

  ('in_app_calling', false,
   'In-app masked calling',
   'Proxied voice calls so neither party sees the other''s real number. Phase 1 scope per PRD Section 08; flag stays off until a telephony provider is wired up.',
   null),

  ('negotiable_pricing', false,
   'Negotiable listings',
   'Lets providers publish a listing as "Price on request" and settle the number in chat before a booking is created. PRD Section 08.',
   null),

  ('rider_delivery', false,
   'Rider-assigned delivery',
   'Assigns Nexa riders to Delivery and Delivery + Return bookings. With this off, those categories fall back to categories.delivery_mode = ''provider'' and the provider arranges delivery. PRD Section 17 names this as the worked example of a flag-gated subsystem.',
   null),

  ('caution_fee', false,
   'Caution fee on rentals',
   'Collects and holds a separate damage deposit on Delivery + Return bookings, refunded on the return code or claimed by Admin decision. PRD Section 10.',
   null),

  ('contact_info_flagging', false,
   'Contact-info flagging',
   'Scans in-app messages for phone and bank account numbers and surfaces them to Admin. Flags, never silently blocks — false positives happen. PRD Section 08.',
   null),

  ('coupons', false,
   'Coupons', 'Out of scope for V1 exposure. PRD Section 18.', null),

  ('referrals', false,
   'Referral programme', 'Out of scope for V1 exposure. PRD Section 18.', null)
on conflict (key) do nothing;

-- Not present, and that is the point: `ai_recommendations`, `marketing_automation`,
-- and `advanced_analytics`. PRD Section 17 calls these "genuinely deferred,
-- including at the architecture level". A flag for them would imply schema behind
-- them. There is none, and none should be added before Phase 3.
