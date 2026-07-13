-- The deposit is the stage-1 release. One number, not two.
--
-- Admin negotiates a vendor's deposit percent and records it on their agreement.
-- Admin shows it. Business Studio shows it. But the money actually released when
-- the vendor accepted a booking came from `stage_1_release_percent` — a separate,
-- platform-wide setting defaulting to 50% — and the negotiated deposit was never
-- read at all. A vendor promised 30% was paid 50%.
--
-- Under the services model the two ideas collapsed into one: the vendor takes a
-- deposit on acceptance so they can buy materials, and the customer's completion
-- code releases the rest. There is no third checkpoint for a second number to
-- describe. So `deposit_percent` becomes the single source of truth, and the
-- parallel setting and its per-provider override are removed rather than left
-- lying around to be wired up again by mistake.

-- ---------------------------------------------------------------------------
-- 1. The deposit drives the release.
-- ---------------------------------------------------------------------------
create or replace function public.resolve_booking_terms(p_provider_id uuid)
returns table (
  commission_percent numeric,
  stage_1_release_percent numeric,
  late_penalty_percent_per_30min numeric,
  deposit_percent numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(a.commission_percent_override,
             public.get_setting_numeric('commission_percent', 10)),
    -- The stage-1 release IS the deposit. Same number, deliberately.
    coalesce(a.deposit_percent,
             public.get_setting_numeric('deposit_percent_min', 10)),
    coalesce(a.late_penalty_percent_per_30min_override,
             public.get_setting_numeric('late_penalty_percent_per_30min', 1)),
    coalesce(a.deposit_percent,
             public.get_setting_numeric('deposit_percent_min', 10))
  from (select 1) as one_row
  left join public.provider_agreements a
    on a.provider_id = p_provider_id
   and a.is_active
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- 2. Retire the parallel knob.
-- ---------------------------------------------------------------------------
-- Nothing reads these any more. Leaving them would invite someone to set one and
-- wonder why it does nothing.
alter table public.provider_agreements
  drop column if exists stage_1_release_percent_override;

delete from public.platform_settings where key = 'stage_1_release_percent';
