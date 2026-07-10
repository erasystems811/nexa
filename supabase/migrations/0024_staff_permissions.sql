-- 0024_staff_permissions.sql
-- Staff roles & granular permissions for the Admin Console. PRD Addendum v1.1 §4.
--
-- PRD.md Section 03 had one undifferentiated "Admin". That stays as the coarse
-- gate: profiles.role = 'admin' means "internal staff, may open the console".
-- Underneath it, this adds *which* staff member with *which* permissions — the
-- real authorisation. is_admin() and every existing RLS policy keep working
-- unchanged; permissions layer on top, enforced in the server actions.
--
-- Core rule (Addendum §4): every staff member has their own login. There is no
-- shared admin account.

create type public.staff_role as enum (
  'super_admin',
  'rider_operations',
  'service_vendor_manager',
  'product_vendor_manager',
  'customer_support',
  'finance',
  'marketing'
);

create table public.staff_members (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null unique references public.profiles (id) on delete cascade,
  staff_role         public.staff_role not null,
  department         text,

  -- The effective permission set. Seeded from the role's default bundle at
  -- creation, then editable per person — the role is a default, not a ceiling
  -- (Addendum §4). A super_admin bypasses this list entirely.
  permissions        text[] not null default '{}',

  status             text not null default 'active' check (status in ('active', 'suspended')),
  two_factor_enabled boolean not null default false,

  invited_by         uuid references public.profiles (id) on delete set null,
  last_login_at      timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index staff_members_role_idx on public.staff_members (staff_role);

create trigger staff_members_set_updated_at
  before update on public.staff_members
  for each row execute function public.set_updated_at();

-- Visible login history per account (Addendum §4).
create table public.staff_login_events (
  id          uuid primary key default gen_random_uuid(),
  staff_id    uuid not null references public.staff_members (id) on delete cascade,
  event       text not null check (event in ('login', 'logout', 'failed_login')),
  ip_address  text,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index staff_login_events_staff_idx on public.staff_login_events (staff_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Authorisation helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff_members
    where user_id = (select auth.uid()) and status = 'active' and staff_role = 'super_admin'
  );
$$;

-- The single question the app asks before any privileged action: "does this
-- staff member hold this permission?" Super admins hold every permission; a
-- suspended staff member holds none.
create or replace function public.staff_has_permission(perm text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_super_admin() or exists (
    select 1 from public.staff_members
    where user_id = (select auth.uid())
      and status = 'active'
      and perm = any (permissions)
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS — the admin module uses the service role, but a staff member's own
-- session may read their record and their login history.
-- ---------------------------------------------------------------------------

alter table public.staff_members enable row level security;
alter table public.staff_login_events enable row level security;

create policy staff_read on public.staff_members
  for select to authenticated
  using (user_id = (select auth.uid()) or public.staff_has_permission('staff.manage'));

create policy staff_manage on public.staff_members
  for all to authenticated
  using (public.staff_has_permission('staff.manage'))
  with check (public.staff_has_permission('staff.manage'));

create policy staff_login_read on public.staff_login_events
  for select to authenticated
  using (
    public.staff_has_permission('staff.manage')
    or exists (select 1 from public.staff_members m where m.id = staff_login_events.staff_id and m.user_id = (select auth.uid()))
  );

grant select, insert, update, delete on public.staff_members to authenticated;
grant select, insert on public.staff_login_events to authenticated;

-- ---------------------------------------------------------------------------
-- Backfill: every existing admin becomes a Super Admin staff member, so the
-- console keeps working for whoever already has access (Addendum §4: no shared
-- account, but existing individual admins are grandfathered as super admins).
-- ---------------------------------------------------------------------------

insert into public.staff_members (user_id, staff_role, permissions, status)
select id, 'super_admin', '{}', 'active'
from public.profiles
where role = 'admin'
on conflict (user_id) do nothing;
