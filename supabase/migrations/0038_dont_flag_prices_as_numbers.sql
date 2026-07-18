-- 0038_dont_flag_prices_as_numbers.sql
-- A quoted price ("₦2,000,000", "2000000 naira") must never read as a phone
-- or account number just because it happens to land on 10 or 11 digits once
-- separators are stripped - that number is exactly what a negotiation is
-- supposed to contain. Mirrors the same fix in
-- src/modules/messaging/safety.ts (the WhatsApp-path scanner).

create or replace function public.scan_message_body(body text)
returns public.moderation_flag_reason[]
language plpgsql
immutable
as $$
declare
  reasons public.moderation_flag_reason[] := '{}';
  compact text := public.compact_digit_runs(body);
  -- A currency-prefixed digit run is a price, not a number to catch - masking
  -- it out here means the bare-digit checks below never see it at all.
  unpriced text := regexp_replace(compact, '(₦|NGN|naira)\s*\d+', 'PRICE', 'gi');
  lowered text := lower(body);
begin
  -- Nigerian mobile: 11 digits starting 070/080/081/090/091..., or +234 form.
  if unpriced ~ '(^|\D)(\+?234|234)[789]\d{9}(\D|$)'
     or unpriced ~ '(^|\D)0[789]\d{9}(\D|$)' then
    reasons := array_append(reasons, 'phone_number'::public.moderation_flag_reason);
  end if;

  -- NUBAN account numbers are exactly 10 digits. The boundaries matter: without
  -- them an 11-digit phone number would also read as an account number.
  if unpriced ~ '(^|\D)\d{10}(\D|$)' then
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
