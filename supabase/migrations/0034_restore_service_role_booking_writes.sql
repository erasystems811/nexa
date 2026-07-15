-- Restore the service-role exemption on the booking guard.
--
-- 0030 rewrote guard_booking_end_user_write and dropped the clause that let the
-- service role through: the original guarded `auth.uid() is null or is_admin()`,
-- and the rewrite kept only `is_admin()`. But every legitimate status change —
-- a customer paying, a vendor accepting, a completion code being entered — is
-- made by the bookings SERVICE on the service-role client, which has no
-- auth.uid() and is not is_admin(). So the rewrite quietly broke the entire
-- booking lifecycle: the guard meant to stop a participant editing their own
-- booking was stopping the platform from advancing it.
--
-- auth.uid() is null is the service role, which is Nexa's own trusted code, not a
-- participant. It belongs in the exemption, exactly as it was.

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
     or new.stage_2_at is distinct from old.stage_2_at
     or new.completed_at is distinct from old.completed_at then
    raise exception 'Booking terms and checkpoints are set by the platform, not by a participant'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;
