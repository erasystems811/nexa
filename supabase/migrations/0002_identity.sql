-- 0002_identity.sql
-- Profiles (one row per auth user) and the role helpers every RLS policy leans on.
-- PRD Section 03.

create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  role          public.user_role not null default 'customer',
  full_name     text,
  phone         text,
  phone_verified_at timestamptz,
  avatar_url    text,
  city_id       uuid,  -- fk added in 0003, after cities exists
  is_suspended  boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index profiles_role_idx on public.profiles (role);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Mirrors the role onto the JWT's app_metadata so `auth.jwt()` can answer
-- "what role is this?" without a table read inside every RLS policy. A policy
-- that selects from profiles to authorise a read of profiles recurses.
create or replace function public.sync_role_to_auth_metadata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
                             || jsonb_build_object('role', new.role::text)
   where id = new.id;
  return new;
end;
$$;

create trigger profiles_sync_role
  after insert or update of role on public.profiles
  for each row execute function public.sync_role_to_auth_metadata();

-- Reads the role from the JWT. STABLE, so the planner calls it once per query.
create or replace function public.current_role_name()
returns public.user_role
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb
      -> 'app_metadata' ->> 'role',
    'customer'
  )::public.user_role;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select public.current_role_name() = 'admin';
$$;

-- A new auth user always lands as a customer. Provider and rider are *applications*
-- (0004, 0005) that an admin approves; they are never granted at sign-up, or anyone
-- could self-serve their way into a provider surface. Admin is never self-assigned.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
