-- 0006_listings.sql
-- Listings, media, availability. PRD Sections 04, 06, 13.

create table public.listings (
  id            uuid primary key default gen_random_uuid(),
  provider_id   uuid not null references public.providers (id) on delete cascade,
  category_id   uuid not null references public.categories (id) on delete restrict,

  title         text not null,
  description   text,
  slug          text not null unique,

  price_kobo    bigint check (price_kobo >= 0),
  price_type    public.price_type not null default 'fixed',
  -- Negotiable listings show a range instead of a price (Section 08).
  price_min_kobo bigint check (price_min_kobo >= 0),
  price_max_kobo bigint check (price_max_kobo >= 0),

  payment_type  public.payment_type not null default 'full',

  -- Section 10: rented items carry a caution fee, held apart from escrow.
  caution_fee_kobo bigint not null default 0 check (caution_fee_kobo >= 0),

  status        public.listing_status not null default 'draft',
  rejection_reason text,
  approved_at   timestamptz,
  approved_by   uuid references public.profiles (id) on delete set null,

  -- Section 08 tiered cancellation policy, e.g.
  -- [{"min_hours_before": 168, "refund_percent": 100}, ...]
  -- Calculated automatically, never manual (Section 09).
  cancellation_policy jsonb not null default '[]'::jsonb,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- A fixed-price listing must name its price; a negotiable one must not pretend to.
  constraint listings_fixed_needs_price check (
    price_type <> 'fixed' or price_kobo is not null
  ),
  constraint listings_negotiable_range_ordered check (
    price_min_kobo is null or price_max_kobo is null or price_min_kobo <= price_max_kobo
  )
);

create index listings_provider_idx on public.listings (provider_id);
create index listings_category_idx on public.listings (category_id);
create index listings_status_idx on public.listings (status);

create trigger listings_set_updated_at
  before update on public.listings
  for each row execute function public.set_updated_at();

-- Section 06: "every edit to an existing listing's media or core details
-- re-enters the approval queue". Enforced here rather than trusted to the UI,
-- because the UI is not the only thing that can write to this table.
create or replace function public.listing_edit_requires_reapproval()
returns trigger
language plpgsql
as $$
begin
  -- Admin moderation actions set the status directly; don't fight them.
  if new.status is distinct from old.status then
    return new;
  end if;

  if old.status = 'approved' and (
       new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.price_kobo is distinct from old.price_kobo
    or new.price_min_kobo is distinct from old.price_min_kobo
    or new.price_max_kobo is distinct from old.price_max_kobo
    or new.price_type is distinct from old.price_type
    or new.payment_type is distinct from old.payment_type
    or new.category_id is distinct from old.category_id
    or new.caution_fee_kobo is distinct from old.caution_fee_kobo
  ) then
    new.status := 'pending_approval';
    new.approved_at := null;
    new.approved_by := null;
  end if;

  return new;
end;
$$;

create trigger listings_reapproval
  before update on public.listings
  for each row execute function public.listing_edit_requires_reapproval();

-- Section 06 / 13: every upload enters Pending Approval before it appears publicly.
create table public.listing_media (
  id           uuid primary key default gen_random_uuid(),
  listing_id   uuid not null references public.listings (id) on delete cascade,
  kind         text not null check (kind in ('image', 'video')),
  storage_path text not null,
  alt_text     text,
  sort_order   integer not null default 0,
  status       public.listing_status not null default 'pending_approval',
  reviewed_by  uuid references public.profiles (id) on delete set null,
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index listing_media_listing_idx on public.listing_media (listing_id);

-- Section 13: Available / Booked / Unavailable. Customers only ever see available.
create table public.listing_availability (
  id          uuid primary key default gen_random_uuid(),
  listing_id  uuid not null references public.listings (id) on delete cascade,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  is_available boolean not null default true,
  note        text,
  created_at  timestamptz not null default now(),
  constraint listing_availability_ordered check (starts_at < ends_at)
);

create index listing_availability_listing_idx on public.listing_availability (listing_id, starts_at);

-- Section 14: favourite providers and listings.
create table public.favourites (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  listing_id  uuid references public.listings (id) on delete cascade,
  provider_id uuid references public.providers (id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint favourites_one_target check (num_nonnulls(listing_id, provider_id) = 1)
);

create unique index favourites_unique_listing on public.favourites (user_id, listing_id) where listing_id is not null;
create unique index favourites_unique_provider on public.favourites (user_id, provider_id) where provider_id is not null;
