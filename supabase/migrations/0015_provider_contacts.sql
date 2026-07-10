-- 0015_provider_contacts.sql
-- Fixes a real leak found by the Section 08 end-to-end test: a signed-in
-- customer could read `providers.contact_phone` for any approved provider.
--
-- Why 0013's `revoke select (contact_phone) ... from authenticated` did nothing:
-- Postgres checks the table-level privilege first. 0011 granted SELECT on the
-- whole table to anon and authenticated, and a table-wide grant already covers
-- every column, so revoking the column changed nothing at all.
--
-- Revoking the table grant and re-granting column by column would work, but it
-- would also stop a provider reading their *own* phone number, because column
-- privileges cannot depend on which row you are looking at.
--
-- Row-level visibility is what we actually want, and RLS does rows. So the
-- contact details move to their own table, whose policy is "the owner, or an
-- admin, and nobody else."

create table public.provider_contacts (
  provider_id   uuid primary key references public.providers (id) on delete cascade,
  contact_phone text,
  contact_email text,
  phone_verified_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger provider_contacts_set_updated_at
  before update on public.provider_contacts
  for each row execute function public.set_updated_at();

insert into public.provider_contacts (provider_id, contact_phone, contact_email)
select id, contact_phone, contact_email from public.providers;

alter table public.providers
  drop column contact_phone,
  drop column contact_email;

-- Every provider has exactly one contact row, always.
create or replace function public.bootstrap_provider_contact()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.provider_contacts (provider_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger providers_bootstrap_contact
  after insert on public.providers
  for each row execute function public.bootstrap_provider_contact();

alter table public.provider_contacts enable row level security;

create policy admin_all on public.provider_contacts
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- The owner, and only the owner. A customer looking at a provider's public
-- profile gets no row at all — not a null column, no row.
create policy provider_contacts_own on public.provider_contacts
  for all to authenticated
  using (provider_id = public.my_provider_id())
  with check (provider_id = public.my_provider_id());

grant select, insert, update on public.provider_contacts to authenticated;

-- 0013 revoked select on riders.phone, which was both unnecessary and harmful:
-- `riders` has no public-read policy, so a rider's phone was never exposed, and
-- the revoke stopped a rider reading their own number. Undo it.
grant select (phone) on public.riders to authenticated;

-- The trigger that stops a real subscriber number being written into a proxy
-- column has to follow the phone number to its new home.
create or replace function public.reject_real_numbers_in_call_session()
returns trigger
language plpgsql
security definer
set search_path = ''
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
     and exists (select 1 from public.provider_contacts pc
                 where pc.contact_phone is not null
                   and public.compact_digit_runs(pc.contact_phone) = public.compact_digit_runs(new.provider_proxy_number)) then
    raise exception 'A real subscriber number was written to a proxy column'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;
