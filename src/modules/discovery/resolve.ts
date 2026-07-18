import "server-only";

/**
 * Turns free text from a stranger on WhatsApp ("I want a DJ in Lagos") into a
 * category/city slug where possible.
 *
 * Categories and cities are admin-managed with no fixed list (Section 17: "no
 * hardcoded categories"), so CATEGORY_SYNONYMS below is not a list of
 * categories - it never decides what exists, only helps recognise the
 * everyday word for something that already does. A category renamed or
 * removed just makes its entry here inert, never wrong. `q` always carries
 * the full original text, unstripped, so the full-text search behind it
 * still has every word to work with even when a category or city was found.
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

/**
 * A customer describes a category by what they know it as, not by an admin's
 * chosen name for it - "chef" and "catering" share no letters at all, so no
 * amount of stemming ever connects them. Keyed by slug (stable) rather than
 * name (an admin can reword any time). Not exhaustive by design: this only
 * needs to cover the common everyday words stemming can't reach on its own.
 */
const CATEGORY_SYNONYMS: Record<string, string[]> = {
  catering: ["chef", "cook", "food", "small chops", "chops"],
  cakes: ["cake", "dessert", "baker", "bakery", "pastries"],
  "djs-mcs": ["dj", "mc", "emcee", "host", "compere", "disc jockey"],
  "live-performers": ["band", "singer", "musician", "live music", "performer", "entertainer"],
  photography: ["photographer", "photo", "camera", "pictures", "shoot"],
  videography: ["videographer", "video", "livestream", "streaming"],
  decor: ["decorator", "decoration", "styling", "balloons", "florist", "flowers"],
  "sound-lighting": ["sound", "lighting", "lights", "speaker", "pa system"],
  rentals: ["chairs", "canopy", "tent", "tables", "equipment"],
  venues: ["venue", "hall", "space", "location"],
  "event-staff": ["usher", "waiter", "waitress", "staff"],
  security: ["bouncer", "guard"],
  cleaning: ["cleaner", "cleanup"],
  "transport-logistics": ["transport", "logistics", "bus", "driver"],
  "event-planning": ["planner", "coordinator"],
};

function wordsOf(value: string): string[] {
  return value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

/**
 * "caterer" and "catering" share a root ("cater") but diverge after it - a
 * strict prefix check ("does one fully start with the other") misses this,
 * since neither word is actually a prefix of the other past that point. This
 * instead finds how much of the start the two words share, and treats a
 * long-enough shared root as the same word. Short words ("DJ") still match
 * exactly since the threshold never exceeds the shorter word's own length.
 */
function sharesStem(a: string, b: string): boolean {
  if (a === b) return true;
  const minLen = Math.min(a.length, b.length);
  let shared = 0;
  while (shared < minLen && a[shared] === b[shared]) shared += 1;
  return shared >= Math.min(5, minLen);
}

function wordOrPhraseMatches(text: string, textWords: Set<string>, word: string): boolean {
  if (text.includes(word)) return true;
  for (const textWord of textWords) {
    if (sharesStem(word, textWord)) return true;
  }
  return false;
}

function matches(text: string, textWords: Set<string>, candidate: NamedSlug): boolean {
  const name = candidate.name.toLowerCase();
  if (text.includes(name)) return true;

  const slugWords = candidate.slug.toLowerCase().replace(/-/g, " ");
  if (text.includes(slugWords)) return true;

  for (const nameWord of wordsOf(name)) {
    if (wordOrPhraseMatches(text, textWords, nameWord)) return true;
  }

  for (const synonym of CATEGORY_SYNONYMS[candidate.slug] ?? []) {
    if (wordOrPhraseMatches(text, textWords, synonym)) return true;
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
