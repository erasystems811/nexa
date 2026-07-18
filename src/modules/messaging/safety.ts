import "server-only";

import type { ModerationFlagReason } from "@/lib/db/types";

const BANK_WORDS =
  /\b(account\s*(number|no|nos)|acct|a\/c|opay|moniepoint|kuda|palmpay|gtb|gtbank|zenith|uba|firstbank|first bank|access bank|sterling|fidelity|wema|ecobank|stanbic|union bank|polaris|keystone)\b/i;

const OFF_PLATFORM_WORDS =
  /\b(whatsapp|whats app|wats app|watsapp|telegram|instagram|snapchat|dm me|inbox me)\b|(?:call|text|message|chat|reach)\s+me\s+(?:on|at|through|via)|(?:outside|off)\s+(?:the\s+)?(?:app|platform)|(?:pay|send)\s+(?:me\s+)?(?:directly|cash|outside)/i;

/** A price quoted in chat ("₦2,000,000", "2000000 naira") must never read as a
 * phone number or account number just because it happens to land on 10 or 11
 * digits once separators are stripped - this is precisely the number a
 * negotiation is expected to contain. */
const CURRENCY_MARKER = /(₦|\bNGN\b|\bnaira\b)\s*$/i;

function precededByCurrency(compact: string, digitsStartAt: number): boolean {
  return CURRENCY_MARKER.test(compact.slice(0, digitsStartAt));
}

export function scanMessageBody(body: string): ModerationFlagReason[] {
  const compact = compactDigitRuns(body);
  const reasons = new Set<ModerationFlagReason>();

  if (hasUnpricedMatch(compact, /(^|\D)((\+?234|234)[789]\d{9}|0[789]\d{9})(\D|$)/g)) {
    reasons.add("phone_number");
  }

  if (hasUnpricedMatch(compact, /(^|\D)(\d{10})(\D|$)/g) || BANK_WORDS.test(body)) {
    reasons.add("bank_account");
  }

  if (OFF_PLATFORM_WORDS.test(body)) {
    reasons.add("off_platform_solicitation");
  }

  return [...reasons];
}

/** True if the pattern matches somewhere that isn't immediately after a
 * currency marker - i.e. a genuine phone/account number, not a price. */
function hasUnpricedMatch(compact: string, pattern: RegExp): boolean {
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(compact))) {
    const digitsStartAt = match.index + (match[1]?.length ?? 0);
    if (!precededByCurrency(compact, digitsStartAt)) return true;
  }
  return false;
}

function compactDigitRuns(value: string): string {
  let current = value;
  for (let i = 0; i < 12; i += 1) {
    const next = current.replace(/(\d)[\s.\-()]+(\d)/g, "$1$2");
    if (next === current) return current;
    current = next;
  }
  return current;
}
