import "server-only";

import type { ModerationFlagReason } from "@/lib/db/types";

/**
 * Bank flagging, in two tiers, so a bank name catches off-platform payment
 * attempts without flagging every ordinary sentence:
 *
 *   HARD  coined bank / fintech names that never appear in ordinary event chat.
 *         Naming one at all is a flag ("pay me on my opay").
 *   SOFT  bank names that are also everyday words (access, sterling, fidelity…).
 *         Flagged ONLY when the message is clearly about money — otherwise
 *         "do you have access to the venue?" or "high-fidelity sound" would trip.
 *
 * Full multi-word forms ("access bank", "first bank") are HARD — unambiguous.
 * A human still reviews every flag, so the bar is "plausible payment attempt".
 */
const HARD_BANK = new RegExp(
  `\\b(${[
    // Fintechs / neobanks (coined words)
    "opay", "palmpay", "palm\\s*pay", "moniepoint", "monie\\s*point", "kuda",
    "fairmoney", "fair\\s*money", "vbank", "vfd", "rubies", "eyowo", "chipper",
    "piggyvest", "piggy\\s*vest", "cowrywise", "gomoney", "go\\s*money", "renmoney",
    "aella", "mintyn", "sofri", "roqqu",
    // Banks (abbreviations / coined names)
    "gtb", "gtbank", "gtworld", "uba", "fcmb", "ecobank", "wema", "alat",
    "providus", "globus", "suntrust", "jaiz", "parallex", "stanbic", "ibtc", "optimus",
    // Unambiguous when written in full
    "access\\s*bank", "first\\s*bank", "firstbank", "fbn", "union\\s*bank",
    "unity\\s*bank", "heritage\\s*bank", "sterling\\s*bank", "keystone\\s*bank",
    "polaris\\s*bank", "nova\\s*bank", "diamond\\s*bank", "zenith\\s*bank",
    "fidelity\\s*bank", "premium\\s*trust", "premiumtrust", "titan\\s*trust",
    "standard\\s*chartered", "lotus\\s*bank", "taj\\s*bank", "coronation",
  ].join("|")})\\b`,
  "i",
);

const SOFT_BANK = new RegExp(
  `\\b(${[
    "access", "sterling", "fidelity", "zenith", "keystone", "polaris", "nova",
    "diamond", "carbon", "sparkle", "unity", "heritage", "union",
  ].join("|")})\\b`,
  "i",
);

/** A bare request for an account number — a flag on its own. */
const ACCOUNT_PHRASE = /\b(account\s*(number|no|nos|details)|acct|a\/c|bank\s*details|nuban)\b/i;

/** Signals the message is about moving money — used to un-ambiguate SOFT_BANK. */
const ACCOUNT_CONTEXT =
  /\b(account|acct|a\/c|bank|transfer|send|sent|pay|paid|deposit|number|details|wallet|nuban)\b|₦|\bngn\b|\bnaira\b/i;

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

  // An account number (10 digits, not a price), a bare "account number" phrase,
  // or a bank name. A hard bank name flags outright; a soft one only when the
  // message is otherwise about money — or sits next to an account number.
  const accountNumber = hasUnpricedMatch(compact, /(^|\D)(\d{10})(\D|$)/g);
  const namesBank =
    HARD_BANK.test(body) || (SOFT_BANK.test(body) && (ACCOUNT_CONTEXT.test(body) || accountNumber));

  if (accountNumber || ACCOUNT_PHRASE.test(body) || namesBank) {
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
