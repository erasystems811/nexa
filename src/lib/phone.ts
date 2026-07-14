/**
 * Nigerian phone numbers, in the shape WhatsApp actually wants.
 *
 * People write their number the way they say it: 0802 274 8369. WhatsApp deep
 * links want it in international form with no leading zero and no plus —
 * 2348022748369 — and a link built from the local form silently goes nowhere.
 * So the number is normalised here rather than trusted to be typed correctly in
 * an environment variable.
 */

const NIGERIA = "234";

/** "08022748369" | "+234 802 274 8369" | "8022748369" -> "2348022748369" */
export function toWhatsAppNumber(raw: string | undefined | null): string | null {
  if (!raw) return null;

  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  // Already international.
  if (digits.startsWith(NIGERIA)) return digits;

  // Local form: the leading 0 is a domestic prefix, not part of the number.
  if (digits.startsWith("0")) return NIGERIA + digits.slice(1);

  // Bare subscriber number (10 digits, no trunk prefix).
  if (digits.length === 10) return NIGERIA + digits;

  // Some other country, already written internationally. Leave it alone.
  return digits;
}
