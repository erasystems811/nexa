-- 0019_fix_listing_status_guard.sql
--
-- Bug found by the Business Studio end-to-end test: a provider could not edit or
-- pause an approved listing.
--
-- guard_listing_status_change (0011) required BOTH the old and the new status to
-- be provider-settable. But the legitimate moves out of 'approved' — the
-- re-approval demotion when a price is edited (listings_reapproval, 0006), and a
-- pause — both start from 'approved', which is NOT provider-settable. So the
-- guard blocked the very transitions Section 06 and 13 require, and the edit
-- failed with a permission error instead of returning to the queue.
--
-- The rule the guard actually wants is simpler and only about the destination:
-- a provider may move a listing INTO {draft, pending_approval, paused} from
-- anywhere, and may never move one TO {approved, rejected, changes_requested,
-- hidden}. Those four are Admin's.

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

  -- Only the destination matters. approved -> pending_approval (re-approval) and
  -- approved -> paused are fine; anything -> approved/rejected/hidden is not.
  if new.status is distinct from old.status
     and not (new.status = any (provider_settable)) then
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
