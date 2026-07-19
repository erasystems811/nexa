-- 0039_support_requests.sql
-- A general "contact Nexa" channel - until now the only way to reach Nexa was
-- a support email buried in the legal pages, or a dispute, which only exists
-- once a booking does. This is for everything else: a question, a problem,
-- a customer who hasn't even booked anything yet. Two channels feed the same
-- queue - the website contact form, and typing "help" to the WhatsApp bot -
-- so nothing about how a request arrived changes how Admin handles it.

create type public.support_request_channel as enum ('web', 'whatsapp');
create type public.support_request_status as enum ('open', 'in_progress', 'resolved');

create table public.support_requests (
  id              uuid primary key default gen_random_uuid(),
  channel         public.support_request_channel not null,
  -- Whoever it is, however Nexa knows how to reach them back - a web visitor
  -- may not be signed in at all, and a WhatsApp customer has no email.
  customer_id     uuid references public.profiles (id) on delete set null,
  name            text,
  contact         text not null,
  message         text not null,
  status          public.support_request_status not null default 'open',
  assigned_to     uuid references public.profiles (id) on delete set null,
  resolved_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index support_requests_status_idx on public.support_requests (status, created_at desc);

create trigger support_requests_set_updated_at
  before update on public.support_requests
  for each row execute function public.set_updated_at();

alter table public.support_requests enable row level security;

-- Anyone can reach out - a web visitor need not be signed in, and a WhatsApp
-- stranger has no session at all (the bot writes this row with the service
-- role, same as everything else it does).
create policy support_requests_insert on public.support_requests
  for insert to anon, authenticated
  with check (true);

create policy admin_all on public.support_requests
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select, insert, update on public.support_requests to anon, authenticated;

-- The admin-settable list of WhatsApp numbers that get pinged the moment a
-- new help request comes in. Deliberately not tied to staff_members: a
-- number worth notifying (a shared support line, someone covering for the
-- week) is not always a full staff account.
create table public.support_notification_numbers (
  id          uuid primary key default gen_random_uuid(),
  phone       text not null unique,
  label       text,
  created_at  timestamptz not null default now()
);

alter table public.support_notification_numbers enable row level security;

create policy admin_all on public.support_notification_numbers
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
