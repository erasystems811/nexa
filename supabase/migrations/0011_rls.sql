-- 0011_rls.sql
-- Row Level Security. This file *is* the permission model in PRD Section 03;
-- the Next.js middleware only decides which URL a role may open, it is not a
-- security boundary. Anything the browser can reach with an anon key is
-- governed here.
--
--   Admin    — everything.
--   Provider — only their own business.
--   Customer — the public marketplace + their own bookings.
--   Rider    — assigned deliveries only.

-- ---------------------------------------------------------------------------
-- Ownership helpers. SECURITY DEFINER so a policy on `listings` may look up
-- `providers` without needing a policy on `providers` to permit it.
-- ---------------------------------------------------------------------------

create or replace function public.my_provider_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.providers where user_id = (select auth.uid());
$$;

create or replace function public.my_rider_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.riders where user_id = (select auth.uid());
$$;

create or replace function public.owns_booking_as_provider(p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.bookings b
    where b.id = p_booking_id and b.provider_id = public.my_provider_id()
  );
$$;

create or replace function public.owns_booking_as_customer(p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.bookings b
    where b.id = p_booking_id and b.customer_id = (select auth.uid())
  );
$$;

create or replace function public.assigned_to_booking_as_rider(p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.rider_assignments ra
    where ra.booking_id = p_booking_id and ra.rider_id = public.my_rider_id()
  );
$$;

-- A user cannot promote themselves. Role changes come from the provider/rider
-- approval triggers (0004, 0005) or from an admin, never from a profile update.
create or replace function public.guard_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    -- The approval triggers run as SECURITY DEFINER with no JWT, so
    -- current_role_name() defaults to 'customer'. Allow those through by
    -- checking that a real end-user session is what's driving the change.
    if (select auth.uid()) is not null then
      raise exception 'Role changes are administered, not self-assigned'
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.guard_profile_role_change();

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere. A table without RLS in a Supabase project is a table
-- the whole internet can read with the anon key.
-- ---------------------------------------------------------------------------

alter table public.profiles                     enable row level security;
alter table public.cities                       enable row level security;
alter table public.categories                   enable row level security;
alter table public.event_types                  enable row level security;
alter table public.providers                    enable row level security;
alter table public.provider_categories          enable row level security;
alter table public.provider_documents           enable row level security;
alter table public.provider_agreements          enable row level security;
alter table public.provider_strikes             enable row level security;
alter table public.provider_reliability         enable row level security;
alter table public.provider_wallets             enable row level security;
alter table public.riders                       enable row level security;
alter table public.rider_documents              enable row level security;
alter table public.rider_reliability            enable row level security;
alter table public.rider_wallets                enable row level security;
alter table public.listings                     enable row level security;
alter table public.listing_media                enable row level security;
alter table public.listing_availability         enable row level security;
alter table public.favourites                   enable row level security;
alter table public.event_projects               enable row level security;
alter table public.event_project_checklist_items enable row level security;
alter table public.bookings                     enable row level security;
alter table public.booking_confirmation_codes   enable row level security;
alter table public.rider_assignments            enable row level security;
alter table public.payments                     enable row level security;
alter table public.payment_ledger_entries       enable row level security;
alter table public.penalty_applications         enable row level security;
alter table public.payouts                      enable row level security;
alter table public.payment_webhook_events       enable row level security;
alter table public.conversations                enable row level security;
alter table public.messages                     enable row level security;
alter table public.call_sessions                enable row level security;
alter table public.moderation_flags             enable row level security;
alter table public.reviews                      enable row level security;
alter table public.disputes                     enable row level security;
alter table public.dispute_evidence             enable row level security;
alter table public.notifications                enable row level security;
alter table public.notification_preferences     enable row level security;
alter table public.audit_log                    enable row level security;
alter table public.platform_settings            enable row level security;
alter table public.feature_flags                enable row level security;

-- ---------------------------------------------------------------------------
-- Admin: full access to every table, expressed once.
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','cities','categories','event_types','providers','provider_categories',
    'provider_documents','provider_agreements','provider_strikes','provider_reliability',
    'provider_wallets','riders','rider_documents','rider_reliability','rider_wallets',
    'listings','listing_media','listing_availability','favourites','event_projects',
    'event_project_checklist_items','bookings','booking_confirmation_codes',
    'rider_assignments','payments','payment_ledger_entries','penalty_applications',
    'payouts','payment_webhook_events','conversations','messages','call_sessions',
    'moderation_flags','reviews','disputes','dispute_evidence','notifications',
    'notification_preferences','audit_log','platform_settings','feature_flags'
  ] loop
    execute format(
      'create policy admin_all on public.%I for all to authenticated
         using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------

create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Taxonomy — public read of active rows; admin writes (covered by admin_all).
-- ---------------------------------------------------------------------------

create policy cities_public_read on public.cities
  for select to anon, authenticated using (is_active);

create policy categories_public_read on public.categories
  for select to anon, authenticated using (is_active);

create policy event_types_public_read on public.event_types
  for select to anon, authenticated using (is_active);

-- ---------------------------------------------------------------------------
-- Providers — Section 05: nothing unapproved is publicly visible.
-- ---------------------------------------------------------------------------

create policy providers_public_read on public.providers
  for select to anon, authenticated using (status = 'approved');

create policy providers_read_own on public.providers
  for select to authenticated using (user_id = (select auth.uid()));

-- A provider edits their own profile. They cannot approve themselves: the
-- status/approval columns are rejected by the trigger below, not by this policy,
-- because RLS has no column-level WITH CHECK.
create policy providers_update_own on public.providers
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Anyone signed in may apply to become a provider. The row starts 'pending'.
create policy providers_apply on public.providers
  for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending');

create or replace function public.guard_provider_self_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() and (select auth.uid()) is not null then
    if new.status is distinct from old.status
       or new.strike_count is distinct from old.strike_count
       or new.is_on_probation is distinct from old.is_on_probation
       or new.approved_at is distinct from old.approved_at
       or new.approved_by is distinct from old.approved_by then
      raise exception 'Verification state is set by Admin, not by the provider'
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;

create trigger providers_guard_self_approval
  before update on public.providers
  for each row execute function public.guard_provider_self_approval();

create policy provider_categories_public_read on public.provider_categories
  for select to anon, authenticated using (true);

create policy provider_categories_manage_own on public.provider_categories
  for all to authenticated
  using (provider_id = public.my_provider_id())
  with check (provider_id = public.my_provider_id());

-- Select and insert, never update: a provider submits a document, and does not
-- get to mark their own NIN 'approved' (Section 05).
create policy provider_documents_read_own on public.provider_documents
  for select to authenticated using (provider_id = public.my_provider_id());

create policy provider_documents_submit on public.provider_documents
  for insert to authenticated
  with check (provider_id = public.my_provider_id() and status = 'pending');

-- The provider reads their agreement; only admin writes it (Section 20).
create policy provider_agreements_read_own on public.provider_agreements
  for select to authenticated using (provider_id = public.my_provider_id());

create policy provider_strikes_read_own on public.provider_strikes
  for select to authenticated using (provider_id = public.my_provider_id());

-- Section 17: reliability data is collected from booking one, but the public
-- only sees it when the platform flag AND the per-provider switch both say yes.
create policy provider_reliability_public_read on public.provider_reliability
  for select to anon, authenticated
  using (
    is_publicly_visible
    and public.is_feature_enabled('public_reliability_score')
  );

create policy provider_reliability_read_own on public.provider_reliability
  for select to authenticated using (provider_id = public.my_provider_id());

create policy provider_wallets_read_own on public.provider_wallets
  for select to authenticated using (provider_id = public.my_provider_id());

-- Bank details are the provider's to set; balances are not.
create policy provider_wallets_update_own on public.provider_wallets
  for update to authenticated
  using (provider_id = public.my_provider_id())
  with check (provider_id = public.my_provider_id());

create or replace function public.guard_wallet_balance_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() and (select auth.uid()) is not null then
    if new.pending_kobo is distinct from old.pending_kobo
       or new.available_kobo is distinct from old.available_kobo
       or new.withdrawn_kobo is distinct from old.withdrawn_kobo then
      raise exception 'Wallet balances are written by the payments service only'
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;

create trigger provider_wallets_guard_balance
  before update on public.provider_wallets
  for each row execute function public.guard_wallet_balance_write();

create trigger rider_wallets_guard_balance
  before update on public.rider_wallets
  for each row execute function public.guard_wallet_balance_write();

-- ---------------------------------------------------------------------------
-- Riders — not a public directory. A rider sees themselves; admin sees all.
-- ---------------------------------------------------------------------------

create policy riders_read_own on public.riders
  for select to authenticated using (user_id = (select auth.uid()));

create policy riders_apply on public.riders
  for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending');

create policy riders_update_own on public.riders
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create or replace function public.guard_rider_self_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() and (select auth.uid()) is not null then
    if new.status is distinct from old.status
       or new.approved_at is distinct from old.approved_at
       or new.approved_by is distinct from old.approved_by then
      raise exception 'Verification state is set by Admin, not by the rider'
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;

create trigger riders_guard_self_approval
  before update on public.riders
  for each row execute function public.guard_rider_self_approval();

create policy rider_documents_read_own on public.rider_documents
  for select to authenticated using (rider_id = public.my_rider_id());

create policy rider_documents_submit on public.rider_documents
  for insert to authenticated
  with check (rider_id = public.my_rider_id() and status = 'pending');

create policy rider_reliability_read_own on public.rider_reliability
  for select to authenticated using (rider_id = public.my_rider_id());

create policy rider_wallets_read_own on public.rider_wallets
  for select to authenticated using (rider_id = public.my_rider_id());

create policy rider_wallets_update_own on public.rider_wallets
  for update to authenticated
  using (rider_id = public.my_rider_id())
  with check (rider_id = public.my_rider_id());

-- ---------------------------------------------------------------------------
-- Listings — Section 06: nothing unapproved reaches the marketplace, and a
-- suspended provider's listings vanish immediately (Section 05).
-- ---------------------------------------------------------------------------

create policy listings_public_read on public.listings
  for select to anon, authenticated
  using (
    status = 'approved'
    and exists (
      select 1 from public.providers p
      where p.id = listings.provider_id and p.status = 'approved'
    )
  );

create policy listings_manage_own on public.listings
  for all to authenticated
  using (provider_id = public.my_provider_id())
  with check (provider_id = public.my_provider_id());

create policy listing_media_public_read on public.listing_media
  for select to anon, authenticated
  using (
    status = 'approved'
    and exists (
      select 1 from public.listings l
      join public.providers p on p.id = l.provider_id
      where l.id = listing_media.listing_id
        and l.status = 'approved' and p.status = 'approved'
    )
  );

create policy listing_media_manage_own on public.listing_media
  for all to authenticated
  using (exists (select 1 from public.listings l
                 where l.id = listing_media.listing_id
                   and l.provider_id = public.my_provider_id()))
  with check (exists (select 1 from public.listings l
                      where l.id = listing_media.listing_id
                        and l.provider_id = public.my_provider_id()));

-- listings_manage_own is FOR ALL and RLS cannot restrict columns, so on its own
-- it would let a provider UPDATE their own listing to status='approved' and walk
-- straight past the approval queue. PRD Section 06 is explicit that no listing —
-- and no edit to one — reaches the marketplace without Admin review.
--
-- A provider may move a listing between draft, pending_approval, and paused
-- (pausing your own listing is Business Studio behaviour, Section 13). Only an
-- admin may approve, reject, hide, or restore.
create or replace function public.guard_listing_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  provider_settable constant public.listing_status[] :=
    array['draft', 'pending_approval', 'paused']::public.listing_status[];
begin
  if (select auth.uid()) is null or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if not (new.status = any (provider_settable)) then
      raise exception 'A new listing starts as draft or pending approval, not %', new.status
        using errcode = 'insufficient_privilege';
    end if;
    return new;
  end if;

  if new.status is distinct from old.status
     and not (new.status = any (provider_settable) and old.status = any (provider_settable)) then
    raise exception 'Listing approval is an Admin decision (tried % -> %)', old.status, new.status
      using errcode = 'insufficient_privilege';
  end if;

  if new.approved_at is distinct from old.approved_at
     or new.approved_by is distinct from old.approved_by then
    raise exception 'Approval metadata is set by Admin'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

-- Runs after listings_reapproval (0006), which is the trigger that knocks an
-- approved listing back to pending_approval when its price or copy changes.
-- Trigger order within a timing point is alphabetical: listings_reapproval,
-- then listings_zz_guard_status. The name buys that ordering on purpose.
create trigger listings_zz_guard_status
  before insert or update on public.listings
  for each row execute function public.guard_listing_status_change();

-- Same reasoning for media: every upload enters Pending Approval (Section 06).
create or replace function public.guard_listing_media_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'pending_approval';
    return new;
  end if;

  if new.status is distinct from old.status then
    raise exception 'Media approval is an Admin decision'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

create trigger listing_media_guard_status
  before insert or update on public.listing_media
  for each row execute function public.guard_listing_media_status();

create policy listing_availability_public_read on public.listing_availability
  for select to anon, authenticated using (true);

create policy listing_availability_manage_own on public.listing_availability
  for all to authenticated
  using (exists (select 1 from public.listings l
                 where l.id = listing_availability.listing_id
                   and l.provider_id = public.my_provider_id()))
  with check (exists (select 1 from public.listings l
                      where l.id = listing_availability.listing_id
                        and l.provider_id = public.my_provider_id()));

create policy favourites_own on public.favourites
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Event Projects — schema live from Phase 1, exposure gated (Section 17).
-- ---------------------------------------------------------------------------

create policy event_projects_own on public.event_projects
  for all to authenticated
  using (customer_id = (select auth.uid()) and public.is_feature_enabled('plan_my_event'))
  with check (customer_id = (select auth.uid()) and public.is_feature_enabled('plan_my_event'));

create policy event_project_checklist_own on public.event_project_checklist_items
  for all to authenticated
  using (exists (select 1 from public.event_projects e
                 where e.id = event_project_checklist_items.event_project_id
                   and e.customer_id = (select auth.uid())))
  with check (exists (select 1 from public.event_projects e
                      where e.id = event_project_checklist_items.event_project_id
                        and e.customer_id = (select auth.uid())));

-- ---------------------------------------------------------------------------
-- Bookings — the four-role read surface, in one policy.
-- ---------------------------------------------------------------------------

create policy bookings_read_participants on public.bookings
  for select to authenticated
  using (
    customer_id = (select auth.uid())
    or provider_id = public.my_provider_id()
    or public.assigned_to_booking_as_rider(id)
  );

create policy bookings_customer_insert on public.bookings
  for insert to authenticated
  with check (customer_id = (select auth.uid()) and status = 'pending');

-- Status transitions run through the bookings service, which is the only place
-- the state machine lives. Direct customer/provider updates here are limited to
-- their own rows; the service (service-role key) does the rest.
create policy bookings_provider_update on public.bookings
  for update to authenticated
  using (provider_id = public.my_provider_id())
  with check (provider_id = public.my_provider_id());

create policy bookings_customer_update on public.bookings
  for update to authenticated
  using (customer_id = (select auth.uid()))
  with check (customer_id = (select auth.uid()));

-- The two policies above let a participant write their own booking row, and RLS
-- cannot restrict *which columns*. Without this, a customer could PATCH their
-- own booking to status='completed' or agreed_price_kobo=0 with nothing but an
-- anon key. Money and lifecycle move through the bookings/payments services
-- (service role, where auth.uid() is null) or an admin — never from a session.
create or replace function public.guard_booking_end_user_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or public.is_admin() then
    return new;
  end if;

  if new.status is distinct from old.status then
    raise exception 'Booking status is advanced by the bookings service, not directly'
      using errcode = 'insufficient_privilege';
  end if;

  if new.agreed_price_kobo is distinct from old.agreed_price_kobo
     or new.delivery_fee_kobo is distinct from old.delivery_fee_kobo
     or new.caution_fee_kobo is distinct from old.caution_fee_kobo
     or new.commission_percent is distinct from old.commission_percent
     or new.stage_1_release_percent is distinct from old.stage_1_release_percent
     or new.late_penalty_percent_per_30min is distinct from old.late_penalty_percent_per_30min
     or new.stage_1_at is distinct from old.stage_1_at
     or new.stage_2_at is distinct from old.stage_2_at
     or new.completed_at is distinct from old.completed_at
     or new.late_minutes is distinct from old.late_minutes then
    raise exception 'Booking terms and checkpoints are set by the platform, not by a participant'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

create trigger bookings_guard_end_user_write
  before update on public.bookings
  for each row execute function public.guard_booking_end_user_write();

-- Same reasoning for the insert path: a customer opens a booking, but does not
-- get to name its commission or its price independently of the listing.
create or replace function public.guard_booking_insert_terms()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  t record;
begin
  if (select auth.uid()) is null or public.is_admin() then
    return new;
  end if;

  select * into t from public.resolve_booking_terms(new.provider_id);
  if not found then
    raise exception 'Provider % has no active agreement; cannot price a booking', new.provider_id
      using errcode = 'check_violation';
  end if;

  new.commission_percent := t.commission_percent;
  new.stage_1_release_percent := t.stage_1_release_percent;
  new.late_penalty_percent_per_30min := t.late_penalty_percent_per_30min;
  return new;
end;
$$;

create trigger bookings_guard_insert_terms
  before insert on public.bookings
  for each row execute function public.guard_booking_insert_terms();

-- Section 10, the load-bearing policy of the whole trust model: the code is
-- shown ONLY to the customer. No provider policy, no rider policy. A rider
-- learns the code when the customer reads it out, and in no other way.
create policy booking_codes_customer_only on public.booking_confirmation_codes
  for select to authenticated
  using (public.owns_booking_as_customer(booking_id));

create policy rider_assignments_read on public.rider_assignments
  for select to authenticated
  using (
    rider_id = public.my_rider_id()
    or public.owns_booking_as_provider(booking_id)
    or public.owns_booking_as_customer(booking_id)
  );

-- A rider accepts/declines and advances their own leg; assignment itself is
-- an admin/system action (Section 12: "assign or reassign a rider manually").
create policy rider_assignments_update_own on public.rider_assignments
  for update to authenticated
  using (rider_id = public.my_rider_id())
  with check (rider_id = public.my_rider_id());

-- A rider advances their own leg. They do not decide what they are paid for it,
-- nor reassign the job to themselves from another rider.
create or replace function public.guard_rider_assignment_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or public.is_admin() then
    return new;
  end if;

  if new.fee_share_kobo is distinct from old.fee_share_kobo
     or new.rider_id is distinct from old.rider_id
     or new.booking_id is distinct from old.booking_id
     or new.leg is distinct from old.leg then
    raise exception 'Assignment and payout are set by the platform, not the rider'
      using errcode = 'insufficient_privilege';
  end if;

  -- 'delivered' and 'returned' are reached by entering the customer's
  -- confirmation code, which the bookings service verifies. A rider cannot
  -- simply declare a delivery done (PRD Section 10, 15).
  if new.status in ('delivered', 'returned') and old.status is distinct from new.status then
    raise exception 'A delivery completes on the customer''s confirmation code, not by marking it done'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

create trigger rider_assignments_guard_write
  before update on public.rider_assignments
  for each row execute function public.guard_rider_assignment_write();

-- ---------------------------------------------------------------------------
-- Payments — readable by the parties, writable by nobody but the service.
-- Every write path goes through the Payments module (Section 17).
-- ---------------------------------------------------------------------------

create policy payments_read_participants on public.payments
  for select to authenticated
  using (
    public.owns_booking_as_customer(booking_id)
    or public.owns_booking_as_provider(booking_id)
  );

create policy payment_ledger_read_own on public.payment_ledger_entries
  for select to authenticated
  using (
    provider_id = public.my_provider_id()
    or rider_id = public.my_rider_id()
    or customer_id = (select auth.uid())
  );

create policy penalty_applications_read on public.penalty_applications
  for select to authenticated
  using (
    public.owns_booking_as_customer(booking_id)
    or public.owns_booking_as_provider(booking_id)
  );

create policy payouts_read_own on public.payouts
  for select to authenticated
  using (provider_id = public.my_provider_id() or rider_id = public.my_rider_id());

-- payment_webhook_events: admin_all only. Webhooks arrive on the service role.

-- ---------------------------------------------------------------------------
-- Messaging — Section 08
-- ---------------------------------------------------------------------------

create policy conversations_participants on public.conversations
  for all to authenticated
  using (customer_id = (select auth.uid()) or provider_id = public.my_provider_id())
  with check (customer_id = (select auth.uid()) or provider_id = public.my_provider_id());

create policy messages_read_participants on public.messages
  for select to authenticated
  using (exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id
      and (c.customer_id = (select auth.uid()) or c.provider_id = public.my_provider_id())
  ));

create policy messages_send on public.messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.customer_id = (select auth.uid()) or c.provider_id = public.my_provider_id())
    )
  );

create policy call_sessions_participants on public.call_sessions
  for all to authenticated
  using (exists (
    select 1 from public.conversations c
    where c.id = call_sessions.conversation_id
      and (c.customer_id = (select auth.uid()) or c.provider_id = public.my_provider_id())
  ))
  with check (exists (
    select 1 from public.conversations c
    where c.id = call_sessions.conversation_id
      and (c.customer_id = (select auth.uid()) or c.provider_id = public.my_provider_id())
  ));

-- moderation_flags: admin_all only. The flagged party is not told what tripped it.

-- ---------------------------------------------------------------------------
-- Reviews — public; written by the customer on a completed booking only.
-- ---------------------------------------------------------------------------

create policy reviews_public_read on public.reviews
  for select to anon, authenticated using (true);

create policy reviews_customer_insert on public.reviews
  for insert to authenticated
  with check (customer_id = (select auth.uid()) and public.owns_booking_as_customer(booking_id));

-- "Reply to reviews" (Section 13) is the whole of a provider's write access to a
-- review. Without this, the same UPDATE policy would let them rewrite the four
-- rating axes that feed their own reliability score.
create policy reviews_provider_reply on public.reviews
  for update to authenticated
  using (provider_id = public.my_provider_id())
  with check (provider_id = public.my_provider_id());

create or replace function public.guard_review_scores()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or public.is_admin() then
    return new;
  end if;

  if new.quality is distinct from old.quality
     or new.punctuality is distinct from old.punctuality
     or new.communication is distinct from old.communication
     or new.value is distinct from old.value
     or new.comment is distinct from old.comment
     or new.customer_id is distinct from old.customer_id
     or new.booking_id is distinct from old.booking_id then
    raise exception 'A provider may reply to a review, not rewrite it'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

create trigger reviews_guard_scores
  before update on public.reviews
  for each row execute function public.guard_review_scores();

-- ---------------------------------------------------------------------------
-- Disputes
-- ---------------------------------------------------------------------------

create policy disputes_participants_read on public.disputes
  for select to authenticated
  using (
    public.owns_booking_as_customer(booking_id)
    or public.owns_booking_as_provider(booking_id)
  );

create policy disputes_raise on public.disputes
  for insert to authenticated
  with check (
    raised_by = (select auth.uid())
    and (public.owns_booking_as_customer(booking_id) or public.owns_booking_as_provider(booking_id))
  );

create policy dispute_evidence_participants on public.dispute_evidence
  for all to authenticated
  using (exists (
    select 1 from public.disputes d
    where d.id = dispute_evidence.dispute_id
      and (public.owns_booking_as_customer(d.booking_id) or public.owns_booking_as_provider(d.booking_id))
  ))
  with check (uploaded_by = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------

create policy notifications_own on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));

create policy notifications_mark_read on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy notification_preferences_own on public.notification_preferences
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- audit_log: admin_all only.

-- ---------------------------------------------------------------------------
-- Settings & flags — readable by everyone (the marketplace needs the delivery
-- fee and the flags to render), writable by admin only.
-- ---------------------------------------------------------------------------

create policy platform_settings_read on public.platform_settings
  for select to anon, authenticated using (true);

create policy feature_flags_read on public.feature_flags
  for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- Grants. RLS narrows what a role may touch; without a grant it may touch
-- nothing at all.
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage on all sequences in schema public to authenticated;
grant execute on all functions in schema public to anon, authenticated;
