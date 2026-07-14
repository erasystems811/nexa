-- A booking commission, as a suggestion — not a rule.
--
-- Nexa still computes nobody's cut. The customer pays, Nexa holds the whole
-- amount, and a person decides what the vendor gets. That has not changed and is
-- not going to.
--
-- What this adds is arithmetic the admin was otherwise doing in their head. With
-- a commission on file, "Pay the vendor" opens with the amount already worked out
-- — the whole held amount, less Nexa's cut — and the admin can still type over it.
-- The number is a default, and the person is still the decision.
--
-- Set to 0 and Nexa suggests paying the vendor everything.

insert into public.platform_settings (key, value, value_type, label, description, min_value, max_value)
values (
  'commission_percent',
  '0'::jsonb,
  'percent',
  'Booking commission (%)',
  'What Nexa keeps from a booking. This only sets the amount "Pay the vendor" opens with — you can always pay more or less. Set it to 0 to suggest paying the vendor the full amount.',
  0,
  100
)
on conflict (key) do update
  set label = excluded.label,
      description = excluded.description,
      min_value = excluded.min_value,
      max_value = excluded.max_value;
