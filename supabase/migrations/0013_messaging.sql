-- 0013_messaging.sql
-- In-app chat, masked calling, and contact-info flagging. PRD Section 08.
--
-- The scanner lives in the database, not the application. A trigger cannot be
-- skipped by a client that talks to PostgREST directly, and `is_flagged` is not
-- a value the sender gets to choose.

-- ---------------------------------------------------------------------------
-- 1. Close the phone-number leak left open in Phase 1.
-- ---------------------------------------------------------------------------
-- Section 08: "All pre-booking conversation happens through in-app chat and
-- in-app voice calling — never by exchanging personal numbers."
--
-- providers_public_read (0011) lets anyone read an approved provider's row, and
-- RLS has no column granularity — so contact_phone and contact_email were
-- readable by the whole internet with the anon key. Column privileges are the
-- mechanism Postgres does offer, so use those.
--
-- Consequence: no end-user role can read these columns, admin included. The
-- Admin Console reaches them through the service-role client, and the telephony
-- service reads them server-side to place a masked call. They never travel to
-- a browser.

revoke select (contact_phone, contact_email) on public.providers from anon, authenticated;

-- Same reasoning for the rider's phone, which rider_assignments_read would
-- otherwise surface to a customer once assignment lands.
revoke select (phone) on public.riders from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Off-platform solicitation flags on both sides. Section 08: "This applies
--    in both directions."
-- ---------------------------------------------------------------------------

alter table public.providers
  add column confirmed_solicitation_count integer not null default 0;

alter table public.profiles
  add column confirmed_solicitation_count integer not null default 0;

create type public.moderation_flag_status as enum ('pending', 'confirmed', 'dismissed');

alter table public.moderation_flags
  add column conversation_id uuid references public.conversations (id) on delete cascade,
  add column status public.moderation_flag_status not null default 'pending',
  add column confirmed_at timestamptz,
  add column confirmed_by uuid references public.profiles (id) on delete set null,
  -- Section 08: a confirmed attempt "is logged as a strike, the same consequence
  -- structure as a no-show". The strike system itself lands with Provider
  -- Management; this is the link it will populate.
  add column strike_id uuid references public.provider_strikes (id) on delete set null;

create index moderation_flags_status_idx on public.moderation_flags (status)
  where status = 'pending';
create index moderation_flags_subject_idx on public.moderation_flags (subject_id);

-- Confirming a flag increments the subject's counter. Converting that counter
-- into a strike stays an Admin judgment call (Section 05: no automatic
-- threshold), so nothing here writes to provider_strikes.
create or replace function public.apply_confirmed_solicitation_flag()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'confirmed' and old.status is distinct from 'confirmed' then
    update public.profiles
       set confirmed_solicitation_count = confirmed_solicitation_count + 1
     where id = new.subject_id;

    update public.providers
       set confirmed_solicitation_count = confirmed_solicitation_count + 1
     where user_id = new.subject_id;
  end if;
  return new;
end;
$$;

create trigger moderation_flags_apply_confirmation
  after update of status on public.moderation_flags
  for each row execute function public.apply_confirmed_solicitation_flag();

-- ---------------------------------------------------------------------------
-- 3. The scanner.
-- ---------------------------------------------------------------------------
-- Section 08: "not silently blocked, since false positives happen, but surfaced
-- so Admin can act." This function decides what is suspicious. It never decides
-- whether a message sends — that is not its job.

-- Collapses separators sitting *between digits*, so "0 8 0 3-456.7890" reads as
-- one number. Postgres regex has no lookbehind, so this repeats until stable
-- rather than matching in one pass.
create or replace function public.compact_digit_runs(body text)
returns text
language plpgsql
immutable
as $$
declare
  current text := body;
  previous text;
begin
  for i in 1..12 loop
    previous := current;
    current := regexp_replace(current, '(\d)[\s.\-()]+(\d)', '\1\2', 'g');
    exit when current = previous;
  end loop;
  return current;
end;
$$;

create or replace function public.scan_message_body(body text)
returns public.moderation_flag_reason[]
language plpgsql
immutable
as $$
declare
  reasons public.moderation_flag_reason[] := '{}';
  compact text := public.compact_digit_runs(body);
  lowered text := lower(body);
begin
  -- Nigerian mobile: 11 digits starting 070/080/081/090/091..., or +234 form.
  if compact ~ '(^|\D)(\+?234|234)[789]\d{9}(\D|$)'
     or compact ~ '(^|\D)0[789]\d{9}(\D|$)' then
    reasons := array_append(reasons, 'phone_number'::public.moderation_flag_reason);
  end if;

  -- NUBAN account numbers are exactly 10 digits. The boundaries matter: without
  -- them an 11-digit phone number would also read as an account number.
  if compact ~ '(^|\D)\d{10}(\D|$)' then
    reasons := array_append(reasons, 'bank_account'::public.moderation_flag_reason);
  end if;

  -- Naming a bank next to digits is a stronger signal than either alone, and
  -- catches "send to my opay" where the number arrives in a later message.
  if lowered ~ '(account\s*(number|no|nos)|acct|a/c\b)'
     or lowered ~ '\y(opay|moniepoint|kuda|palmpay|gtb|gtbank|zenith|uba|firstbank|first bank|access bank|sterling|fidelity|wema|ecobank|stanbic|union bank|polaris|keystone)\y' then
    reasons := array_append(reasons, 'bank_account'::public.moderation_flag_reason);
  end if;

  -- An explicit attempt to move the conversation off Nexa.
  if lowered ~ '\y(whatsapp|whats app|wats app|watsapp|telegram|instagram|snapchat|dm me|inbox me)\y'
     or lowered ~ '(call|text|message|chat|reach)\s+me\s+(on|at|through|via)'
     or lowered ~ '(outside|off)\s+(the\s+)?(app|platform)'
     or lowered ~ '(pay|send)\s+(me\s+)?(directly|cash|outside)' then
    reasons := array_append(reasons, 'off_platform_solicitation'::public.moderation_flag_reason);
  end if;

  -- array_append can add bank_account twice; callers want a set.
  return (select coalesce(array_agg(distinct r), '{}') from unnest(reasons) r);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Wire the scanner to messages. The sender cannot opt out.
-- ---------------------------------------------------------------------------

alter table public.messages
  add column flag_reasons public.moderation_flag_reason[] not null default '{}';

create or replace function public.scan_message_on_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  found public.moderation_flag_reason[];
begin
  -- Whatever the client posted for these, the trigger decides.
  new.is_flagged := false;
  new.flag_reason := null;
  new.flag_reasons := '{}';

  if not public.is_feature_enabled('contact_info_flagging') then
    return new;
  end if;

  found := public.scan_message_body(new.body);

  if array_length(found, 1) > 0 then
    new.is_flagged := true;
    new.flag_reasons := found;
    new.flag_reason := found[1];
  end if;

  return new;
end;
$$;

create trigger messages_scan
  before insert on public.messages
  for each row execute function public.scan_message_on_insert();

-- The message sends regardless (Section 08). This only raises the flag Admin
-- sees, one row per distinct reason.
create or replace function public.raise_moderation_flags()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.moderation_flag_reason;
begin
  if not new.is_flagged then
    return new;
  end if;

  foreach r in array new.flag_reasons loop
    insert into public.moderation_flags (message_id, conversation_id, subject_id, reason, excerpt)
    values (new.id, new.conversation_id, new.sender_id, r, left(new.body, 280));
  end loop;

  return new;
end;
$$;

create trigger messages_raise_flags
  after insert on public.messages
  for each row execute function public.raise_moderation_flags();

-- A sender must not be able to edit a flagged message into innocence, or
-- rewrite history after the other party has read it. Marking read is the only
-- update anyone gets.
create or replace function public.guard_message_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or public.is_admin() then
    return new;
  end if;

  if new.body is distinct from old.body
     or new.sender_id is distinct from old.sender_id
     or new.conversation_id is distinct from old.conversation_id
     or new.is_flagged is distinct from old.is_flagged
     or new.flag_reason is distinct from old.flag_reason
     or new.flag_reasons is distinct from old.flag_reasons then
    raise exception 'A sent message cannot be edited'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

create trigger messages_guard_update
  before update on public.messages
  for each row execute function public.guard_message_update();

-- Only the person who did NOT send it may mark it read.
create policy messages_mark_read on public.messages
  for update to authenticated
  using (
    sender_id <> (select auth.uid())
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.customer_id = (select auth.uid()) or c.provider_id = public.my_provider_id())
    )
  )
  with check (true);

-- Keeps the conversation list sortable without a correlated subquery per row.
create or replace function public.touch_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations
     set last_message_at = new.created_at
   where id = new.conversation_id;
  return new;
end;
$$;

create trigger messages_touch_conversation
  after insert on public.messages
  for each row execute function public.touch_conversation();

-- ---------------------------------------------------------------------------
-- 5. Conversation uniqueness.
-- ---------------------------------------------------------------------------
-- The 0009 constraint `unique (customer_id, provider_id, listing_id)` does not
-- do what it looks like: in SQL, NULL <> NULL, so a general (listing-less)
-- conversation could be created over and over. Partial indexes fix that.

alter table public.conversations
  drop constraint conversations_customer_id_provider_id_listing_id_key;

create unique index conversations_unique_with_listing
  on public.conversations (customer_id, provider_id, listing_id)
  where listing_id is not null;

create unique index conversations_unique_without_listing
  on public.conversations (customer_id, provider_id)
  where listing_id is null;

-- ---------------------------------------------------------------------------
-- 6. Masked calling. Section 08: "neither side sees the other's real phone
--    number."
-- ---------------------------------------------------------------------------
-- The table below stores proxy numbers only. Real numbers live on profiles and
-- providers, are unreadable by end users after step 1, and are read server-side
-- by the telephony service at the moment a call is placed.

create type public.call_status as enum (
  'requested', 'ringing', 'in_progress', 'completed', 'failed', 'no_answer', 'cancelled'
);

alter table public.call_sessions
  add column status public.call_status not null default 'requested',
  -- The provider-agnostic id for this masked session (Twilio/Africa's Talking/…).
  add column session_ref text,
  add column telephony_provider text,
  -- What each party dials. Never a real subscriber number.
  add column customer_proxy_number text,
  add column provider_proxy_number text,
  add column expires_at timestamptz,
  add column failure_reason text;

create index call_sessions_conversation_idx on public.call_sessions (conversation_id);
create index call_sessions_session_ref_idx on public.call_sessions (session_ref);

-- Defence in depth: if a real Nigerian number is ever written into a proxy
-- column by a buggy adapter, the row is rejected rather than shown to a user.
create or replace function public.reject_real_numbers_in_call_session()
returns trigger
language plpgsql
as $$
begin
  if new.customer_proxy_number is not null
     and exists (select 1 from public.profiles p
                 where p.phone is not null
                   and public.compact_digit_runs(p.phone) = public.compact_digit_runs(new.customer_proxy_number)) then
    raise exception 'A real subscriber number was written to a proxy column'
      using errcode = 'check_violation';
  end if;

  if new.provider_proxy_number is not null
     and exists (select 1 from public.providers pr
                 where pr.contact_phone is not null
                   and public.compact_digit_runs(pr.contact_phone) = public.compact_digit_runs(new.provider_proxy_number)) then
    raise exception 'A real subscriber number was written to a proxy column'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger call_sessions_reject_real_numbers
  before insert or update on public.call_sessions
  for each row execute function public.reject_real_numbers_in_call_session();

-- A participant may read and end their own call; they may not invent one.
-- Sessions are created by the telephony service (service role), because
-- creating one requires reading both real numbers.
drop policy call_sessions_participants on public.call_sessions;

create policy call_sessions_read on public.call_sessions
  for select to authenticated
  using (exists (
    select 1 from public.conversations c
    where c.id = call_sessions.conversation_id
      and (c.customer_id = (select auth.uid()) or c.provider_id = public.my_provider_id())
  ));

-- ---------------------------------------------------------------------------
-- 7. Realtime, so a chat thread updates without polling.
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;

-- ---------------------------------------------------------------------------
-- 8. Turn the two Section 08 features on.
-- ---------------------------------------------------------------------------
-- Both are Phase 1 scope per PRD Section 19; they were seeded OFF in 0012 only
-- because nothing implemented them yet. This is the config change the feature
-- flag design exists to make possible.

update public.feature_flags set enabled = true
 where key in ('contact_info_flagging', 'in_app_calling');
