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
  categorySlug?: string;
  citySlug?: string;
  q: string;
}

function wordsOf(value: string): string[] {
  return value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

function matches(text: string, textWords: Set<string>, candidate: NamedSlug): boolean {
  const name = candidate.name.toLowerCase();
  if (text.includes(name)) return true;

  const slugWords = candidate.slug.toLowerCase().replace(/-/g, " ");
  if (text.includes(slugWords)) return true;

  // A single-word category/city name ("DJs", "Lagos") only needs one word to
  // match; a multi-word one ("Event Planning") needs the substring check
  // above, since checking "event" or "planning" alone would over-match.
  const nameWords = wordsOf(name);
  if (nameWords.length === 1 && textWords.has(nameWords[0]!)) return true;

  return false;
}

export function resolveQuery(
  text: string,
  categories: NamedSlug[],
  cities: NamedSlug[],
): ResolvedQuery {
  const lowered = text.toLowerCase();
  const textWords = new Set(wordsOf(text));

  const category = categories.find((c) => matches(lowered, textWords, c));
  const city = cities.find((c) => matches(lowered, textWords, c));

  return {
    categorySlug: category?.slug,
    citySlug: city?.slug,
    q: text,
  };
}
