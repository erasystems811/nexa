-- 0018_business_studio.sql
-- Business Studio. PRD Section 13.
--
-- Almost everything Studio needs already exists: listings_manage_own, the
-- pending-approval guards (0011), the wallet-balance guard, the read-only
-- provider agreement (deposit % is Admin's, Section 05). This migration adds
-- the few things that do not: a media bucket, the "ready for pickup" checkpoint,
-- and two columns the self-approval guard forgot.

-- ---------------------------------------------------------------------------
-- 1. Close two gaps in the provider self-edit guard.
-- ---------------------------------------------------------------------------
-- providers_guard_self_approval (0011) blocks status, strikes, probation, and
-- approval metadata — but not is_featured (added 0016) or the solicitation
-- counter (added 0013). Without this a provider could feature their own
-- business on the marketplace home, or quietly zero their off-platform strikes.

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
       or new.is_featured is distinct from old.is_featured
       or new.confirmed_solicitation_count is distinct from old.confirmed_solicitation_count
       or new.approved_at is distinct from old.approved_at
       or new.approved_by is distinct from old.approved_by then
      raise exception 'That field is set by Admin, not by the provider'
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. "Mark ready for pickup". PRD Section 13.
-- ---------------------------------------------------------------------------
-- For a physical-goods booking the provider marks the item ready, and that is
-- ALL they do — "the provider does not arrange their own delivery." Marking
-- ready is what will trigger rider assignment in Phase 5. It is not stage 1 and
-- releases no money: the rider's pickup is the stage-1 checkpoint (Section 10),
-- and that lands with the Rider App.
--
-- So this is a timestamp, deliberately inert for now. Recording it here means
-- Phase 5 switches on rider assignment without a schema change.

alter table public.bookings
  add column ready_for_pickup_at timestamptz;

-- The guard on end-user booking writes (0011) rejects any column it does not
-- explicitly allow, and it does not know about this one. Permit the provider —
-- and only the provider on their own goods booking — to set it once.
create or replace function public.guard_booking_ready_for_pickup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or public.is_admin() then
    return new;
  end if;

  if new.ready_for_pickup_at is distinct from old.ready_for_pickup_at then
    -- Only the provider who owns the booking.
    if new.provider_id <> public.my_provider_id() then
      raise exception 'Only the provider can mark their booking ready'
        using errcode = 'insufficient_privilege';
    end if;
    -- Only physical goods have a pickup (Section 15).
    if new.fulfillment_type not in ('delivery', 'delivery_return') then
      raise exception 'A service booking has no pickup to mark ready'
        using errcode = 'check_violation';
    end if;
    -- Only once the booking is paid and accepted, and only forward.
    if old.ready_for_pickup_at is not null then
      raise exception 'This booking is already marked ready'
        using errcode = 'check_violation';
    end if;
    if new.status not in ('accepted', 'in_progress') then
      raise exception 'Mark ready only after the booking is accepted'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

-- Runs before the blanket end-user guard so a legitimate ready-mark is not
-- caught by it. bookings_guard_end_user_write allows an UPDATE that changes no
-- money/status columns, which a ready-mark does not, so the two coexist.
create trigger bookings_guard_ready_for_pickup
  before update on public.bookings
  for each row execute function public.guard_booking_ready_for_pickup();

-- ---------------------------------------------------------------------------
-- 3. Media storage. PRD Section 13, Section 06.
-- ---------------------------------------------------------------------------
-- A private bucket. Files are never world-readable; the marketplace shows an
-- image only after an Admin approves the listing_media row, and even then
-- through a signed URL minted server-side. A provider reads and writes only
-- files under their own provider-id prefix.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'provider-media', 'provider-media', false,
  52428800,  -- 50 MB, enough for the short talent videos Section 11 requires
  array['image/jpeg','image/png','image/webp','image/avif','video/mp4','video/quicktime']
)
on conflict (id) do nothing;

-- Path convention: provider-media/{provider_id}/{listing_id}/{filename}
-- The first path segment is the provider id, which is what these policies check.

create policy provider_media_read_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'provider-media'
    and (storage.foldername(name))[1] = public.my_provider_id()::text
  );

create policy provider_media_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'provider-media'
    and (storage.foldername(name))[1] = public.my_provider_id()::text
  );

create policy provider_media_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'provider-media'
    and (storage.foldername(name))[1] = public.my_provider_id()::text
  );

create policy provider_media_admin_all on storage.objects
  for all to authenticated
  using (bucket_id = 'provider-media' and public.is_admin())
  with check (bucket_id = 'provider-media' and public.is_admin());
