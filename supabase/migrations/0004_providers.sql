-- 0004_providers.sql
-- Provider business profile, verification, agreement, reliability, wallet.
-- PRD Sections 04, 05, 11.
--
-- Naming note (PRD Section 16): user-facing copy always says "Provider"; the
-- table is named providers rather than vendors because there is no legacy
-- vendors table to stay compatible with.

create table public.providers (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null unique references public.profiles (id) on delete cascade,
  business_name     text not null,
  slug              text not null unique,
  description       text,
  logo_url          text,
  cover_url         text,
  city_id           uuid references public.cities (id) on delete set null,
  address           text,
  address_lat       numeric(9,6),
  address_lng       numeric(9,6),
  contact_email     text,
  contact_phone     text,
  social_links      jsonb not null default '{}'::jsonb,
  business_hours    jsonb not null default '{}'::jsonb,

  status            public.verification_status not null default 'pending',
  rejection_reason  text,
  approved_at       timestamptz,
  approved_by       uuid references public.profiles (id) on delete set null,

  -- Section 05: the first 2-3 bookings get closer admin attention.
  is_on_probation   boolean not null default true,

  -- Section 05: strikes accumulate; removal is an admin judgment call, never
  -- an automatic threshold. Deliberately no `max_strikes` constant anywhere.
  strike_count      integer not null default 0,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index providers_status_idx on public.providers (status);
create index providers_city_idx on public.providers (city_id);

create trigger providers_set_updated_at
  before update on public.providers
  for each row execute function public.set_updated_at();

-- A provider can operate in several categories (a decorator who also rents chairs).
create table public.provider_categories (
  provider_id uuid not null references public.providers (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete restrict,
  primary key (provider_id, category_id)
);

-- Section 05 verification checklist. Documents are files in Storage; this table
-- tracks what was submitted and who cleared it.
create table public.provider_documents (
  id            uuid primary key default gen_random_uuid(),
  provider_id   uuid not null references public.providers (id) on delete cascade,
  kind          text not null,  -- 'nin' | 'cac' | 'selfie_with_id' | 'bank_bvn' | 'location_photo' | 'reference'
  storage_path  text,
  metadata      jsonb not null default '{}'::jsonb,
  status        public.verification_status not null default 'pending',
  reviewed_by   uuid references public.profiles (id) on delete set null,
  reviewed_at   timestamptz,
  notes         text,
  created_at    timestamptz not null default now()
);

create index provider_documents_provider_idx on public.provider_documents (provider_id);

-- Section 05 / Section 20. Deposit % is negotiated per provider and recorded here.
-- There is deliberately no platform-wide deposit default; the platform only
-- constrains the *range* (a setting, see 0010).
create table public.provider_agreements (
  id                      uuid primary key default gen_random_uuid(),
  provider_id             uuid not null references public.providers (id) on delete cascade,
  deposit_percent         numeric(5,2) not null check (deposit_percent between 0 and 100),

  -- Null means "use the platform default late-arrival penalty" (1% per 30 min,
  -- stored as a setting). A value here is a recorded per-provider override.
  late_penalty_percent_per_30min_override numeric(5,2)
    check (late_penalty_percent_per_30min_override between 0 and 100),

  -- Null means "use the platform default stage-1 release %".
  stage_1_release_percent_override numeric(5,2)
    check (stage_1_release_percent_override between 0 and 100),

  -- Null means "use the platform default commission %".
  commission_percent_override numeric(5,2)
    check (commission_percent_override between 0 and 100),

  signed_at               timestamptz,
  recorded_by             uuid references public.profiles (id) on delete set null,
  is_active               boolean not null default true,
  created_at              timestamptz not null default now()
);

-- Superseded agreements are kept for history; only one is active at a time.
create unique index provider_agreements_one_active
  on public.provider_agreements (provider_id) where is_active;

-- Section 05: a no-show suspends pending appeal; a failed appeal records a strike.
create table public.provider_strikes (
  id          uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers (id) on delete cascade,
  booking_id  uuid,  -- fk added in 0007
  reason      text not null,
  notes       text,
  issued_by   uuid references public.profiles (id) on delete set null,
  appealed_at timestamptz,
  appeal_upheld boolean,
  created_at  timestamptz not null default now()
);

create index provider_strikes_provider_idx on public.provider_strikes (provider_id);

-- Section 11. Collected from the provider's first booking (Section 17), displayed
-- publicly only when a feature flag says so — hence `is_publicly_visible`, the
-- per-provider override the PRD asks for.
create table public.provider_reliability (
  provider_id            uuid primary key references public.providers (id) on delete cascade,
  on_time_rate           numeric(5,2) not null default 0 check (on_time_rate between 0 and 100),
  cancellation_rate      numeric(5,2) not null default 0 check (cancellation_rate between 0 and 100),
  completed_bookings     integer not null default 0,
  repeat_client_rate     numeric(5,2) not null default 0 check (repeat_client_rate between 0 and 100),

  -- Structured review averages, Section 11. Not one star rating.
  avg_quality            numeric(3,2) not null default 0,
  avg_punctuality        numeric(3,2) not null default 0,
  avg_communication      numeric(3,2) not null default 0,
  avg_value              numeric(3,2) not null default 0,

  reliability_score      numeric(5,2),
  is_publicly_visible    boolean not null default false,
  computed_at            timestamptz
);

-- Section 10. Payouts settle on a schedule, so pending and available are distinct.
create table public.provider_wallets (
  provider_id       uuid primary key references public.providers (id) on delete cascade,
  pending_kobo      bigint not null default 0 check (pending_kobo >= 0),
  available_kobo    bigint not null default 0 check (available_kobo >= 0),
  withdrawn_kobo    bigint not null default 0 check (withdrawn_kobo >= 0),
  bank_code         text,
  bank_account_number text,
  bank_account_name text,
  updated_at        timestamptz not null default now()
);

create trigger provider_wallets_set_updated_at
  before update on public.provider_wallets
  for each row execute function public.set_updated_at();

-- Every approved provider gets a reliability row and a wallet, always.
create or replace function public.bootstrap_provider_rows()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.provider_reliability (provider_id) values (new.id) on conflict do nothing;
  insert into public.provider_wallets (provider_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger providers_bootstrap
  after insert on public.providers
  for each row execute function public.bootstrap_provider_rows();

-- Approving a provider promotes the underlying profile to the provider role,
-- which is what unlocks the Business Studio surface. Suspension/removal reverts
-- it, immediately closing the surface (Section 05).
create or replace function public.sync_provider_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'approved' and coalesce(old.status, 'pending') <> 'approved' then
    update public.profiles set role = 'provider' where id = new.user_id and role <> 'admin';
  elsif new.status in ('suspended', 'removed', 'rejected') and old.status = 'approved' then
    update public.profiles set role = 'customer' where id = new.user_id and role <> 'admin';
  end if;
  return new;
end;
$$;

create trigger providers_sync_role
  after update of status on public.providers
  for each row execute function public.sync_provider_role();
