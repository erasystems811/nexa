-- Payout is not scheduled. A vendor is paid the moment the customer's code is
-- entered — there is no batch, no weekly run, nothing to wait for.
delete from public.platform_settings where key = 'payout_schedule_days';
