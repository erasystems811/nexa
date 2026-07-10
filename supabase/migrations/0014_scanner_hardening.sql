-- 0014_scanner_hardening.sql
-- Two evasions the first scanner missed, found by testing it rather than
-- trusting it: "o8o3456789o" (letter o for zero) and "w.h.a.t.s.a.p.p".
--
-- PRD Section 08 is candid that this will never be airtight: "The flagging
-- system exists to catch and discourage the obvious attempts, not to pretend it
-- stops every handshake." These two are obvious attempts.

-- Collapses single punctuation marks sitting between letters, so
-- "w.h.a.t.s.a.p.p" reads as "whatsapp". Spaces are deliberately excluded:
-- folding them would glue ordinary sentences into nonsense words.
create or replace function public.compact_letter_runs(body text)
returns text
language plpgsql
immutable
as $$
declare
  current text := lower(body);
  previous text;
begin
  for i in 1..16 loop
    previous := current;
    current := regexp_replace(current, '([a-z])[.\-_*]([a-z])', '\1\2', 'g');
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
  -- The same text with the usual homoglyph substitutions undone. Scanned in
  -- addition to `compact`, never instead of it.
  --
  -- This is safe against false positives because the digit rules below need ten
  -- or eleven *consecutive* characters drawn only from {o,l,i,s} to fire on an
  -- ordinary word, and English does not supply one.
  deglyphed text := translate(public.compact_digit_runs(body), 'oOlLiIsS', '00111155');
  lettered text := public.compact_letter_runs(body);
  lowered text := lower(body);
begin
  -- Nigerian mobile: 11 digits starting 07/08/09, or the +234 international form.
  if compact ~ '(^|\D)\+?234[789]\d{9}(\D|$)' or compact ~ '(^|\D)0[789]\d{9}(\D|$)'
     or deglyphed ~ '(^|\D)\+?234[789]\d{9}(\D|$)' or deglyphed ~ '(^|\D)0[789]\d{9}(\D|$)' then
    reasons := array_append(reasons, 'phone_number'::public.moderation_flag_reason);
  end if;

  -- NUBAN account numbers are exactly ten digits. The boundaries matter:
  -- without them, an eleven-digit phone number also reads as an account number.
  if compact ~ '(^|\D)\d{10}(\D|$)' or deglyphed ~ '(^|\D)\d{10}(\D|$)' then
    reasons := array_append(reasons, 'bank_account'::public.moderation_flag_reason);
  end if;

  -- Naming a bank is a signal on its own: it catches "send to my opay" where
  -- the digits arrive in a separate message.
  if lettered ~ '(account\s*(number|no|nos)|acct|a/c\y)'
     or lettered ~ '\y(opay|moniepoint|kuda|palmpay|gtb|gtbank|zenith|uba|firstbank|first bank|access bank|sterling|fidelity|wema|ecobank|stanbic|union bank|polaris|keystone)\y' then
    reasons := array_append(reasons, 'bank_account'::public.moderation_flag_reason);
  end if;

  -- An explicit attempt to move the conversation off Nexa.
  if lettered ~ '\y(whatsapp|whats app|wats app|watsapp|telegram|instagram|snapchat|dm me|inbox me)\y'
     or lowered ~ '(call|text|message|chat|reach)\s+me\s+(on|at|through|via)'
     or lowered ~ '(outside|off)\s+(the\s+)?(app|platform)'
     or lowered ~ '(pay|send)\s+(me\s+)?(directly|cash|outside)' then
    reasons := array_append(reasons, 'off_platform_solicitation'::public.moderation_flag_reason);
  end if;

  return (select coalesce(array_agg(distinct r), '{}') from unnest(reasons) r);
end;
$$;
