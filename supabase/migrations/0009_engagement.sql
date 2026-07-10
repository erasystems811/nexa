-- 0009_engagement.sql
-- Messaging, reviews, disputes, notifications. PRD Sections 08, 11, 12, 14.

-- ---------------------------------------------------------------------------
-- Messaging — Section 08
-- ---------------------------------------------------------------------------

create table public.conversations (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  provider_id uuid not null references public.providers (id) on delete cascade,
  listing_id  uuid references public.listings (id) on delete set null,
  booking_id  uuid references public.bookings (id) on delete set null,
  last_message_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (customer_id, provider_id, listing_id)
);

create index conversations_customer_idx on public.conversations (customer_id);
create index conversations_provider_idx on public.conversations (provider_id);

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid not null references public.profiles (id) on delete cascade,
  body            text not null,

  -- Section 08: a detected phone/bank number is "flagged for Admin review — not
  -- silently blocked, since false positives happen". So the message still sends.
  is_flagged      boolean not null default false,
  flag_reason     public.moderation_flag_reason,

  read_at         timestamptz,
  created_at      timestamptz not null default now()
);

create index messages_conversation_idx on public.messages (conversation_id, created_at);
create index messages_flagged_idx on public.messages (is_flagged) where is_flagged;

-- Section 08: calls are proxied so neither side sees the other's real number.
create table public.call_sessions (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  initiator_id    uuid not null references public.profiles (id) on delete cascade,
  provider_ref    text,
  started_at      timestamptz,
  ended_at        timestamptz,
  duration_seconds integer,
  created_at      timestamptz not null default now()
);

-- Admin's queue for Section 08 flags, in both directions.
create table public.moderation_flags (
  id          uuid primary key default gen_random_uuid(),
  message_id  uuid references public.messages (id) on delete cascade,
  subject_id  uuid not null references public.profiles (id) on delete cascade,
  reason      public.moderation_flag_reason not null,
  excerpt     text,
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null,
  -- A confirmed off-platform attempt is a Provider Agreement breach: it becomes
  -- a strike, the same consequence structure as a no-show (Section 08, 20).
  resulted_in_strike boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Reviews — Section 11
-- ---------------------------------------------------------------------------
-- "structured ratings (quality, punctuality, communication, value) tied to a
-- completed booking only" — hence the unique fk to bookings and the trigger.

create table public.reviews (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid not null unique references public.bookings (id) on delete cascade,
  customer_id   uuid not null references public.profiles (id) on delete cascade,
  provider_id   uuid not null references public.providers (id) on delete cascade,

  quality       smallint not null check (quality between 1 and 5),
  punctuality   smallint not null check (punctuality between 1 and 5),
  communication smallint not null check (communication between 1 and 5),
  value         smallint not null check (value between 1 and 5),

  comment       text,
  provider_reply text,
  provider_replied_at timestamptz,

  created_at    timestamptz not null default now()
);

create index reviews_provider_idx on public.reviews (provider_id);

create or replace function public.reject_review_on_incomplete_booking()
returns trigger
language plpgsql
as $$
declare
  s public.booking_status;
begin
  select status into s from public.bookings where id = new.booking_id;
  if s <> 'completed' then
    raise exception 'A review requires a completed booking (booking is %)', s
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger reviews_require_completed_booking
  before insert on public.reviews
  for each row execute function public.reject_review_on_incomplete_booking();

-- ---------------------------------------------------------------------------
-- Disputes — Section 12
-- ---------------------------------------------------------------------------

create table public.disputes (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references public.bookings (id) on delete restrict,
  raised_by   uuid not null references public.profiles (id) on delete restrict,
  reason      text not null,
  description text,
  status      public.dispute_status not null default 'open',

  -- Section 10: a damage claim at return is "a manual Admin decision, not an
  -- automatic deduction".
  is_damage_claim boolean not null default false,
  caution_claim_kobo bigint check (caution_claim_kobo >= 0),

  resolution_note text,
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index disputes_status_idx on public.disputes (status);

create trigger disputes_set_updated_at
  before update on public.disputes
  for each row execute function public.set_updated_at();

create table public.dispute_evidence (
  id           uuid primary key default gen_random_uuid(),
  dispute_id   uuid not null references public.disputes (id) on delete cascade,
  uploaded_by  uuid not null references public.profiles (id) on delete cascade,
  storage_path text,
  note         text,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  kind       text not null,
  title      text not null,
  body       text,
  data       jsonb not null default '{}'::jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, read_at);

create table public.notification_preferences (
  user_id     uuid primary key references public.profiles (id) on delete cascade,
  email_enabled boolean not null default true,
  sms_enabled   boolean not null default false,
  push_enabled  boolean not null default true,
  updated_at    timestamptz not null default now()
);

create trigger notification_preferences_set_updated_at
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Admin audit trail — Section 12 (admins can intervene on payments, statuses,
-- assignments; every intervention needs a name attached to it).
-- ---------------------------------------------------------------------------

create table public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles (id) on delete set null,
  action      text not null,
  entity_type text not null,
  entity_id   uuid,
  before      jsonb,
  after       jsonb,
  created_at  timestamptz not null default now()
);

create index audit_log_entity_idx on public.audit_log (entity_type, entity_id);
create index audit_log_actor_idx on public.audit_log (actor_id, created_at desc);
