import "server-only";

/**
 * Turns free text from a stranger on WhatsApp ("I want a DJ in Lagos") into a
 * category/city slug where possible.
 *
 * Categories and cities are admin-managed with no fixed list (Section 17: "no
 * hardcoded categories"), so there is no synonym table to maintain here - just
 * a match against whatever is actually live right now. `q` always carries the
 * full original text, unstripped, so the full-text search behind it still has
 * every word to work with even when a category or city was found.
 */

interface NamedSlug {
  name: string;
  slug: string;
}

export interface ResolvedQuery {
  /** Every category the message plausibly names - "light" should catch both
   * "Lighting" and "String Lights", not just whichever came first. */
  categorySlugs: string[];
  citySlug?: string;
  q: string;
}

function wordsOf(value: string): string[] {
  return value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

/**
 * "light" should match "Lighting" and "lights" without an exact word match -
 * a plain equality or "does the message contain the whole category name"
 * check misses this whenever the customer types the shorter, everyday form of
 * a word rather than the exact one an admin typed into the category name.
 */
function sharesStem(a: string, b: string): boolean {
  if (a === b) return true;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  return shorter.length >= 3 && longer.startsWith(shorter);
}

function matches(text: string, textWords: Set<string>, candidate: NamedSlug): boolean {
  const name = candidate.name.toLowerCase();
  if (text.includes(name)) return true;

  const slugWords = candidate.slug.toLowerCase().replace(/-/g, " ");
  if (text.includes(slugWords)) return true;

  for (const nameWord of wordsOf(name)) {
    for (const textWord of textWords) {
      if (sharesStem(nameWord, textWord)) return true;
    }
  }

  return false;
}

export function resolveQuery(
  text: string,
  categories: NamedSlug[],
  cities: NamedSlug[],
): ResolvedQuery {
  const lowered = text.toLowerCase();
  const textWords = new Set(wordsOf(text));

  const categorySlugs = categories
    .filter((c) => matches(lowered, textWords, c))
    .map((c) => c.slug);
  const city = cities.find((c) => matches(lowered, textWords, c));

  return {
    categorySlugs,
    citySlug: city?.slug,
    q: text,
  };
}
