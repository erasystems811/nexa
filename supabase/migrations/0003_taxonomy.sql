-- 0003_taxonomy.sql
-- Cities, categories, event types. All admin-managed rows, zero hardcoded values.
-- PRD Section 17: "No hardcoded categories, providers, or cities."
-- PRD Section 01: "There is no fixed launch category list."

create table public.cities (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  state       text,
  country_code text not null default 'NG',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger cities_set_updated_at
  before update on public.cities
  for each row execute function public.set_updated_at();

alter table public.profiles
  add constraint profiles_city_id_fkey
  foreign key (city_id) references public.cities (id) on delete set null;

-- PRD Section 04: every category is tagged with exactly one fulfillment type,
-- which is what decides the payment checkpoints (Section 10) and whether a rider
-- is ever assigned (Section 15).
create table public.categories (
  id                 uuid primary key default gen_random_uuid(),
  parent_id          uuid references public.categories (id) on delete restrict,
  slug               text not null unique,
  name               text not null,
  description        text,
  fulfillment_type   public.fulfillment_type not null,

  -- Section 17 fallback: a category with no registered riders yet runs on
  -- 'provider' delivery. Flipping it to 'rider' is a config change.
  --
  -- Defaults to 'provider' because the constraint below forbids 'rider' on a
  -- service category — a default of 'rider' would make every DJ category
  -- insert fail unless the caller remembered to override it.
  delivery_mode      public.delivery_mode not null default 'provider',

  -- Section 11: talent categories require video, not photos.
  requires_video_proof boolean not null default false,

  icon               text,
  sort_order         integer not null default 0,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  -- delivery_mode is meaningless on a service category; nobody delivers a DJ.
  constraint categories_delivery_mode_only_for_goods check (
    fulfillment_type in ('delivery', 'delivery_return')
    or delivery_mode = 'provider'
  )
);

create index categories_parent_idx on public.categories (parent_id);
create index categories_active_idx on public.categories (is_active) where is_active;

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

-- Does this fulfillment type ever involve a Nexa rider? Section 15.
create or replace function public.fulfillment_uses_rider(ft public.fulfillment_type)
returns boolean
language sql
immutable
as $$
  select ft in ('delivery', 'delivery_return');
$$;

-- PRD Section 07: birthday, wedding, club night, corporate, baby shower,
-- graduation, house party — listed as examples, so they are rows, not an enum.
create table public.event_types (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  icon        text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger event_types_set_updated_at
  before update on public.event_types
  for each row execute function public.set_updated_at();
