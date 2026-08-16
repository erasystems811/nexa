/**
 * Money is kobo (integer) everywhere it is stored or passed around. Naira only
 * exists at the edges — a form field going in, a rendered string coming out.
 * Nothing in between is allowed to be a float.
 */

export type Kobo = number;

export function nairaToKobo(naira: number): Kobo {
  return Math.round(naira * 100);
}

export function koboToNaira(kobo: Kobo): number {
  return kobo / 100;
}

const formatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

export function formatKobo(kobo: Kobo): string {
  return formatter.format(koboToNaira(kobo));
}

/**
 * Splits `kobo` by `percent` and returns [share, remainder], with the remainder
 * absorbing the rounding error so the two always sum back to the original.
 * A stage-1 release of 33% on ₦1,000.01 must not lose or invent a kobo.
 */
export function splitByPercent(kobo: Kobo, percent: number): [Kobo, Kobo] {
  const share = Math.round((kobo * percent) / 100);
  return [share, kobo - share];
}
