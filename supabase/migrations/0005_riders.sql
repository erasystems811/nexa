-- 0005_riders.sql
-- Riders register independently of providers. PRD Sections 04, 15.

create table public.riders (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null unique references public.profiles (id) on delete cascade,
  full_name       text not null,
  phone           text not null,
  city_id         uuid references public.cities (id) on delete set null,

  -- Section 15: vehicle type drives assignment. A bulk chair order does not go
  -- to a bike. Assignment logic reads this; nothing about it is hardcoded.
  vehicle_type    public.vehicle_type not null,
  vehicle_plate   text,

  status          public.verification_status not null default 'pending',
  rejection_reason text,
  approved_at     timestamptz,
  approved_by     uuid references public.profiles (id) on delete set null,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index riders_status_idx on public.riders (status);
create index riders_city_vehicle_idx on public.riders (city_id, vehicle_type);

create trigger riders_set_updated_at
  before update on public.riders
  for each row execute function public.set_updated_at();

create table public.rider_documents (
  id           uuid primary key default gen_random_uuid(),
  rider_id     uuid not null references public.riders (id) on delete cascade,
  kind         text not null,  -- 'nin' | 'drivers_license' | 'vehicle_papers' | 'selfie_with_id'
  storage_path text,
  status       public.verification_status not null default 'pending',
  reviewed_by  uuid references public.profiles (id) on delete set null,
  reviewed_at  timestamptz,
  notes        text,
  created_at   timestamptz not null default now()
);

create index rider_documents_rider_idx on public.rider_documents (rider_id);

-- Section 15: on-time rate and completed-delivery count, tracked the same way
-- provider reliability is.
create table public.rider_reliability (
  rider_id            uuid primary key references public.riders (id) on delete cascade,
  on_time_rate        numeric(5,2) not null default 0 check (on_time_rate between 0 and 100),
  completed_deliveries integer not null default 0,
  cancellation_rate   numeric(5,2) not null default 0 check (cancellation_rate between 0 and 100),
  reliability_score   numeric(5,2),
  is_publicly_visible boolean not null default false,
  computed_at         timestamptz
);

create table public.rider_wallets (
  rider_id       uuid primary key references public.riders (id) on delete cascade,
  pending_kobo   bigint not null default 0 check (pending_kobo >= 0),
  available_kobo bigint not null default 0 check (available_kobo >= 0),
  withdrawn_kobo bigint not null default 0 check (withdrawn_kobo >= 0),
  bank_code           text,
  bank_account_number text,
  bank_account_name   text,
  updated_at     timestamptz not null default now()
);

create trigger rider_wallets_set_updated_at
  before update on public.rider_wallets
  for each row execute function public.set_updated_at();

create or replace function public.bootstrap_rider_rows()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.rider_reliability (rider_id) values (new.id) on conflict do nothing;
  insert into public.rider_wallets (rider_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger riders_bootstrap
  after insert on public.riders
  for each row execute function public.bootstrap_rider_rows();

create or replace function public.sync_rider_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'approved' and coalesce(old.status, 'pending') <> 'approved' then
    update public.profiles set role = 'rider' where id = new.user_id and role <> 'admin';
  elsif new.status in ('suspended', 'removed', 'rejected') and old.status = 'approved' then
    update public.profiles set role = 'customer' where id = new.user_id and role <> 'admin';
  end if;
  return new;
end;
$$;

create trigger riders_sync_role
  after update of status on public.riders
  for each row execute function public.sync_rider_role();
