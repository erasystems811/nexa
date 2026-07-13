import "server-only";

import type { ModerationFlagReason } from "@/lib/db/types";

const BANK_WORDS =
  /\b(account\s*(number|no|nos)|acct|a\/c|opay|moniepoint|kuda|palmpay|gtb|gtbank|zenith|uba|firstbank|first bank|access bank|sterling|fidelity|wema|ecobank|stanbic|union bank|polaris|keystone)\b/i;

const OFF_PLATFORM_WORDS =
  /\b(whatsapp|whats app|wats app|watsapp|telegram|instagram|snapchat|dm me|inbox me)\b|(?:call|text|message|chat|reach)\s+me\s+(?:on|at|through|via)|(?:outside|off)\s+(?:the\s+)?(?:app|platform)|(?:pay|send)\s+(?:me\s+)?(?:directly|cash|outside)/i;

export function scanMessageBody(body: string): ModerationFlagReason[] {
  const compact = compactDigitRuns(body);
  const reasons = new Set<ModerationFlagReason>();

  if (/(^|\D)((\+?234|234)[789]\d{9}|0[789]\d{9})(\D|$)/.test(compact)) {
    reasons.add("phone_number");
  }

  if (/(^|\D)\d{10}(\D|$)/.test(compact) || BANK_WORDS.test(body)) {
    reasons.add("bank_account");
  }

  if (OFF_PLATFORM_WORDS.test(body)) {
    reasons.add("off_platform_solicitation");
  }

  return [...reasons];
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
