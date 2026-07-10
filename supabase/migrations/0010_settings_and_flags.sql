-- 0010_settings_and_flags.sql
-- Platform settings and feature flags. PRD Sections 10, 17, 20.
--
-- Rule this file exists to enforce: commission, stage-1 release %, and delivery
-- fee are rows, not constants. Changing one is an Admin Console edit, never a
-- code deployment.

create table public.platform_settings (
  key         text primary key,
  value       jsonb not null,
  value_type  text not null check (value_type in ('number', 'percent', 'money_kobo', 'string', 'boolean', 'json')),
  label       text not null,
  description text,
  -- Guardrails so an admin cannot set commission to 900% by typo.
  min_value   numeric,
  max_value   numeric,
  updated_by  uuid references public.profiles (id) on delete set null,
  updated_at  timestamptz not null default now()
);

create trigger platform_settings_set_updated_at
  before update on public.platform_settings
  for each row execute function public.set_updated_at();

create or replace function public.enforce_setting_bounds()
returns trigger
language plpgsql
as $$
declare
  n numeric;
begin
  if new.value_type in ('number', 'percent', 'money_kobo') then
    if jsonb_typeof(new.value) <> 'number' then
      raise exception 'Setting % must be a number, got %', new.key, jsonb_typeof(new.value)
        using errcode = 'check_violation';
    end if;
    n := (new.value #>> '{}')::numeric;
    if new.min_value is not null and n < new.min_value then
      raise exception 'Setting % must be >= %', new.key, new.min_value
        using errcode = 'check_violation';
    end if;
    if new.max_value is not null and n > new.max_value then
      raise exception 'Setting % must be <= %', new.key, new.max_value
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger platform_settings_bounds
  before insert or update on public.platform_settings
  for each row execute function public.enforce_setting_bounds();

-- ---------------------------------------------------------------------------
-- Feature flags — Section 17
-- ---------------------------------------------------------------------------
-- "Architecture and exposure are different decisions." The schema for Event
-- Project and Reliability Score exists (0007, 0004). These rows decide who sees
-- them. Turning a feature on is a config change, never a migration.

create table public.feature_flags (
  key         text primary key,
  enabled     boolean not null default false,
  label       text not null,
  description text,

  -- Null = applies platform-wide. Non-null = enabled only for these roles,
  -- which is how a feature gets dogfooded by admins before customers see it.
  enabled_for_roles public.user_role[],

  -- Section 17: reliability score turns on "either platform-wide once there's
  -- enough data, or per-provider once that provider has enough completed jobs".
  -- The per-provider switch is providers.reliability.is_publicly_visible; this
  -- flag is the platform-wide gate above it.
  is_locked   boolean not null default false,  -- true = cannot be toggled from the UI yet

  updated_by  uuid references public.profiles (id) on delete set null,
  updated_at  timestamptz not null default now()
);

create trigger feature_flags_set_updated_at
  before update on public.feature_flags
  for each row execute function public.set_updated_at();

-- Single source of truth for "is this feature on for this caller?" Used by RLS
-- policies and by the app's server-side flag reader alike, so the answer cannot
-- drift between the two.
create or replace function public.is_feature_enabled(flag_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select f.enabled
         and (f.enabled_for_roles is null
              or public.current_role_name() = any (f.enabled_for_roles))
      from public.feature_flags f
      where f.key = flag_key
    ),
    false  -- an unknown flag is off. Fail closed.
  );
$$;

-- Typed reader for settings, with a caller-supplied fallback so a missing row
-- degrades to a sane number rather than a null-propagating arithmetic bug.
create or replace function public.get_setting_numeric(setting_key text, fallback numeric)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select (value #>> '{}')::numeric from public.platform_settings where key = setting_key),
    fallback
  );
$$;

-- Resolves the percentages that get frozen onto a booking at creation:
-- per-provider override first, platform setting second. Section 10, Section 20.
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
    coalesce(a.stage_1_release_percent_override,
             public.get_setting_numeric('stage_1_release_percent', 50)),
    coalesce(a.late_penalty_percent_per_30min_override,
             public.get_setting_numeric('late_penalty_percent_per_30min', 1)),
    a.deposit_percent
  from public.provider_agreements a
  where a.provider_id = p_provider_id and a.is_active
  limit 1;
$$;
