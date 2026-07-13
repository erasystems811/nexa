-- 0027_whatsapp_mediated_messaging.sql
-- WhatsApp-through-Nexa messaging.
--
-- Customers may eventually speak from WhatsApp, but vendors still reply from
-- Business Studio. Nexa remains the system of record for chat, escrow warnings,
-- and admin review.

create type public.message_origin as enum (
  'nexa_dashboard',
  'whatsapp_customer',
  'whatsapp_vendor'
);

alter table public.messages
  add column origin public.message_origin not null default 'nexa_dashboard',
  add column external_message_id text;

create unique index messages_external_message_idx
  on public.messages (external_message_id)
  where external_message_id is not null;

create table public.whatsapp_contacts (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid references public.profiles (id) on delete set null,
  wa_id         text not null unique,
  display_name  text,
  phone_hint    text,
  consent_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger whatsapp_contacts_set_updated_at
  before update on public.whatsapp_contacts
  for each row execute function public.set_updated_at();

create table public.whatsapp_threads (
  id                  uuid primary key default gen_random_uuid(),
  conversation_id      uuid not null unique references public.conversations (id) on delete cascade,
  whatsapp_contact_id  uuid not null references public.whatsapp_contacts (id) on delete cascade,
  business_phone_id    text,
  status              text not null default 'active'
    check (status in ('active', 'paused', 'closed')),
  last_webhook_at      timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index whatsapp_threads_contact_idx on public.whatsapp_threads (whatsapp_contact_id);
create index whatsapp_threads_provider_contact_idx on public.whatsapp_threads (provider_whatsapp_contact_id);

create trigger whatsapp_threads_set_updated_at
  before update on public.whatsapp_threads
  for each row execute function public.set_updated_at();

create table public.blocked_message_attempts (
  id                   uuid primary key default gen_random_uuid(),
  conversation_id       uuid references public.conversations (id) on delete cascade,
  sender_id             uuid references public.profiles (id) on delete set null,
  whatsapp_contact_id   uuid references public.whatsapp_contacts (id) on delete set null,
  channel               public.message_origin not null,
  body                  text not null,
  reasons               public.moderation_flag_reason[] not null default '{}',
  created_at            timestamptz not null default now()
);

create index blocked_message_attempts_conversation_idx
  on public.blocked_message_attempts (conversation_id, created_at desc);

create index blocked_message_attempts_reasons_idx
  on public.blocked_message_attempts using gin (reasons);

alter table public.whatsapp_contacts enable row level security;
alter table public.whatsapp_threads enable row level security;
alter table public.blocked_message_attempts enable row level security;

create policy admin_all on public.whatsapp_contacts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy admin_all on public.whatsapp_threads
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy admin_all on public.blocked_message_attempts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy whatsapp_threads_participants_read on public.whatsapp_threads
  for select to authenticated
  using (exists (
    select 1 from public.conversations c
    where c.id = whatsapp_threads.conversation_id
      and (c.customer_id = (select auth.uid()) or c.provider_id = public.my_provider_id())
  ));

create policy blocked_attempts_sender_read on public.blocked_message_attempts
  for select to authenticated
  using (sender_id = (select auth.uid()));

create or replace function public.blocking_message_reasons(body text)
returns public.moderation_flag_reason[]
language sql
immutable
as $$
  select public.scan_message_body(body);
$$;

insert into public.feature_flags (key, enabled, description)
values
  (
    'whatsapp_mediated_chat',
    false,
    'Routes customer and vendor WhatsApp messages through Nexa so neither side sees the other number and escrow records stay visible.'
  )
on conflict (key) do update
  set description = excluded.description;

grant select, insert, update, delete on public.whatsapp_contacts to authenticated;
grant select, insert, update, delete on public.whatsapp_threads to authenticated;
grant select, insert, update, delete on public.blocked_message_attempts to authenticated;

update public.feature_flags
   set enabled = false,
       description = 'Archived. Nexa communication now runs through the mediated WhatsApp relay, not in-app calling.'
 where key = 'in_app_calling';
