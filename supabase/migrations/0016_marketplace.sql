-- 0016_marketplace.sql
-- Search & Book. PRD Sections 07, 09, 10, 14.
--
-- Plan My Event and Event Stand Mode stay behind their flags. Nothing here
-- touches them.

-- ---------------------------------------------------------------------------
-- 1. Featured providers (PRD Section 14: "featured and top-rated providers")
-- ---------------------------------------------------------------------------

alter table public.providers
  add column is_featured boolean not null default false;

create index providers_featured_idx on public.providers (is_featured) where is_featured;

-- Top-rated is computed from structured reviews (Section 11), not from the
-- reliability score — that stays hidden until Admin enables it (Section 18).
-- security_invoker makes the view obey the caller's RLS rather than the owner's.
create view public.provider_ratings
with (security_invoker = true) as
select
  r.provider_id,
  count(*)::integer as review_count,
  round(avg((r.quality + r.punctuality + r.communication + r.value) / 4.0), 2) as avg_rating
from public.reviews r
group by r.provider_id;

grant select on public.provider_ratings to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Negotiable pricing. PRD Section 08:
--    "customer and provider discuss in-app chat or in-app call before a final
--     price is agreed and a booking is created at that agreed amount."
--
--    So a negotiable booking cannot exist without an accepted offer, and the
--    offer is the only thing that can set its price.
-- ---------------------------------------------------------------------------

create type public.price_offer_status as enum ('pending', 'accepted', 'withdrawn', 'superseded');

create table public.price_offers (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  listing_id      uuid not null references public.listings (id) on delete cascade,
  provider_id     uuid not null references public.providers (id) on delete cascade,
  customer_id     uuid not null references public.profiles (id) on delete cascade,
  amount_kobo     bigint not null check (amount_kobo > 0),
  note            text,
  status          public.price_offer_status not null default 'pending',
  accepted_at     timestamptz,
  created_at      timestamptz not null default now()
);

create index price_offers_conversation_idx on public.price_offers (conversation_id, created_at desc);

-- One live offer per (customer, listing). A new one supersedes the last.
create unique index price_offers_one_pending
  on public.price_offers (customer_id, listing_id)
  where status = 'pending';

create unique index price_offers_one_accepted
  on public.price_offers (customer_id, listing_id)
  where status = 'accepted';

alter table public.price_offers enable row level security;

create policy admin_all on public.price_offers
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy price_offers_read on public.price_offers
  for select to authenticated
  using (customer_id = (select auth.uid()) or provider_id = public.my_provider_id());

-- The provider quotes. The customer never quotes their own price.
create policy price_offers_provider_insert on public.price_offers
  for insert to authenticated
  with check (
    provider_id = public.my_provider_id()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and c.provider_id = public.my_provider_id()
        and c.customer_id = price_offers.customer_id
    )
  );

-- Either side may update: the customer to accept, the provider to withdraw.
-- Which of those they may actually do is settled by the trigger below, because
-- RLS cannot see *which column* changed.
create policy price_offers_update on public.price_offers
  for update to authenticated
  using (customer_id = (select auth.uid()) or provider_id = public.my_provider_id())
  with check (customer_id = (select auth.uid()) or provider_id = public.my_provider_id());

create or replace function public.guard_price_offer_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null or public.is_admin() then
    return new;
  end if;

  if new.amount_kobo is distinct from old.amount_kobo
     or new.listing_id is distinct from old.listing_id
     or new.customer_id is distinct from old.customer_id
     or new.provider_id is distinct from old.provider_id then
    raise exception 'An offer cannot be edited. Send a new one.'
      using errcode = 'insufficient_privilege';
  end if;

  -- Only the customer accepts. A provider accepting their own quote on the
  -- customer's behalf is the entire thing this table exists to prevent.
  if new.status = 'accepted' and old.status <> 'accepted' then
    if actor <> old.customer_id then
      raise exception 'Only the customer can accept an offer'
        using errcode = 'insufficient_privilege';
    end if;
    new.accepted_at := now();
  end if;

  if new.status = 'withdrawn' and old.status <> 'withdrawn' then
    if actor = old.customer_id then
      raise exception 'A customer declines by ignoring an offer, not by withdrawing it'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  return new;
end;
$$;

create trigger price_offers_guard
  before update on public.price_offers
  for each row execute function public.guard_price_offer_write();

-- A new pending offer retires the previous one, so the partial unique index
-- above never blocks a renegotiation.
create or replace function public.supersede_previous_offers()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.price_offers
     set status = 'superseded'
   where customer_id = new.customer_id
     and listing_id = new.listing_id
     and id <> new.id
     and status = 'pending';
  return new;
end;
$$;

create trigger price_offers_supersede
  after insert on public.price_offers
  for each row execute function public.supersede_previous_offers();

-- ---------------------------------------------------------------------------
-- 3. Price a booking from the listing, never from the client.
-- ---------------------------------------------------------------------------
-- Until now `bookings_customer_insert` let a signed-in customer name their own
-- agreed_price_kobo. Nothing checked it against the listing. This trigger takes
-- every money field and the fulfillment type out of the client's hands.

create or replace function public.price_booking_from_listing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  l record;
  cat record;
  offer record;
  is_end_user boolean := (select auth.uid()) is not null and not public.is_admin();
begin
  select * into l from public.listings where id = new.listing_id;
  if not found then
    raise exception 'No such listing' using errcode = 'foreign_key_violation';
  end if;

  select * into cat from public.categories where id = l.category_id;

  -- Nothing unapproved can be booked (Section 05, 06).
  if is_end_user then
    if l.status <> 'approved' then
      raise exception 'That listing is not available' using errcode = 'check_violation';
    end if;
    if not exists (select 1 from public.providers p
                   where p.id = l.provider_id and p.status = 'approved') then
      raise exception 'That provider is not available' using errcode = 'check_violation';
    end if;
    if l.provider_id <> new.provider_id then
      raise exception 'Listing does not belong to that provider' using errcode = 'check_violation';
    end if;
  end if;

  -- Fulfillment type is copied from the category at creation and frozen: a
  -- category retyped next month must not rewrite how an in-flight booking pays.
  new.fulfillment_type := cat.fulfillment_type;

  if is_end_user then
    if l.price_type = 'fixed' then
      new.agreed_price_kobo := l.price_kobo;
    else
      -- Section 08: a negotiable booking exists only at an agreed number.
      select * into offer
        from public.price_offers
       where listing_id = l.id
         and customer_id = new.customer_id
         and status = 'accepted'
       limit 1;

      if not found then
        raise exception 'This listing is priced on request. Agree a price in chat first.'
          using errcode = 'check_violation';
      end if;

      new.agreed_price_kobo := offer.amount_kobo;
    end if;

    -- Section 10: the delivery fee is set by Nexa, not the provider, and only
    -- physical goods carry one.
    if cat.fulfillment_type in ('delivery', 'delivery_return') then
      new.delivery_fee_kobo := public.get_setting_numeric('delivery_fee_kobo', 150000)::bigint;
    else
      new.delivery_fee_kobo := 0;
    end if;

    -- Section 10: a caution fee exists only on Delivery + Return.
    if cat.fulfillment_type = 'delivery_return' and public.is_feature_enabled('caution_fee') then
      new.caution_fee_kobo := l.caution_fee_kobo;
    else
      new.caution_fee_kobo := 0;
    end if;
  end if;

  return new;
end;
$$;

-- Named to sort after bookings_guard_insert_terms, which sets the percentages.
create trigger bookings_price_from_listing
  before insert on public.bookings
  for each row execute function public.price_booking_from_listing();

-- No two live bookings on the same listing at the same time.
create or replace function public.reject_double_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.bookings b
    where b.listing_id = new.listing_id
      and b.id <> new.id
      and b.status in ('pending', 'paid_held', 'accepted', 'in_progress')
      and tstzrange(b.scheduled_start, coalesce(b.scheduled_end, b.scheduled_start + interval '1 hour'))
          && tstzrange(new.scheduled_start, coalesce(new.scheduled_end, new.scheduled_start + interval '1 hour'))
  ) then
    raise exception 'That time is already booked' using errcode = 'exclusion_violation';
  end if;

  if exists (
    select 1 from public.listing_availability a
    where a.listing_id = new.listing_id
      and not a.is_available
      and tstzrange(a.starts_at, a.ends_at)
          && tstzrange(new.scheduled_start, coalesce(new.scheduled_end, new.scheduled_start + interval '1 hour'))
  ) then
    raise exception 'The provider is not available then' using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger bookings_zz_reject_double_booking
  before insert on public.bookings
  for each row execute function public.reject_double_booking();

-- ---------------------------------------------------------------------------
-- 4. Confirmation codes on payment, not on acceptance.
-- ---------------------------------------------------------------------------
-- PRD Section 14: "Each booking displays the customer's delivery confirmation
-- code ... it's front and centre on the order once payment is made."
--
-- Section 09 lists Accepted above Paid/Held, but also says a Rejected booking is
-- "refunded automatically" — which is only possible if the money was already
-- held. Payment therefore precedes acceptance, and the existing mint trigger
-- (0007, fires on paid_held) already lands in the right place. Recorded here
-- because the ordering is not obvious from the PRD table alone.

-- ---------------------------------------------------------------------------
-- 5. Enable the caution fee. Section 10 makes it V1 for Delivery + Return.
-- ---------------------------------------------------------------------------

update public.feature_flags set enabled = true where key = 'caution_fee';
