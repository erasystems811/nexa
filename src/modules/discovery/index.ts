import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { listCategories, listCities } from "@/modules/marketplace";
import { searchListings, type ListingResult } from "@/modules/search";
import { sendWhatsappList, sendWhatsappText } from "@/modules/messaging/whatsapp";
import { resolveQuery } from "./resolve";

/**
 * The front door for a stranger who has never dealt with Nexa before: they
 * text the WhatsApp number cold ("I want a DJ in Lagos"), and this is what
 * turns that into a tappable list of real listings.
 *
 * No conversation state is kept between messages - a single message is
 * resolved and answered in one pass. Picking a result is what actually
 * creates anything (see handleListingSelected in ./whatsapp): searching alone
 * never touches an account.
 */

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 5;
const RESULT_LIMIT = 8;

/**
 * A stranger has no account yet, so nothing else stands between random text
 * sent at the number and repeated searches - this is what stands in. Resets
 * on a rolling window rather than a hard daily cap, so someone genuinely
 * narrowing down a vendor is never the one it throttles.
 */
async function withinRateLimit(contactId: string): Promise<boolean> {
  const db = createAdminClient();
  const { data: contact } = await db
    .from("whatsapp_contacts")
    .select("discovery_message_count, discovery_window_started_at")
    .eq("id", contactId)
    .maybeSingle();

  const windowStartedAt = contact?.discovery_window_started_at
    ? new Date(contact.discovery_window_started_at).getTime()
    : null;
  const windowExpired = windowStartedAt === null || Date.now() - windowStartedAt > RATE_LIMIT_WINDOW_MS;
  const nextCount = windowExpired ? 1 : (contact?.discovery_message_count ?? 0) + 1;

  await db
    .from("whatsapp_contacts")
    .update({
      discovery_message_count: nextCount,
      discovery_window_started_at: windowExpired
        ? new Date().toISOString()
        : contact?.discovery_window_started_at,
    })
    .eq("id", contactId);

  return nextCount <= RATE_LIMIT_MAX;
}

function formatNaira(kobo: number): string {
  return `₦${Math.round(kobo / 100).toLocaleString("en-NG")}`;
}

function priceLabel(listing: ListingResult): string {
  if (listing.priceType === "fixed" && listing.priceKobo !== null) {
    return formatNaira(listing.priceKobo);
  }
  if (listing.priceMinKobo !== null && listing.priceMaxKobo !== null) {
    return `${formatNaira(listing.priceMinKobo)}–${formatNaira(listing.priceMaxKobo)}`;
  }
  return "Price on request";
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
}

export async function runColdDiscovery(input: {
  waId: string;
  text: string;
  contactId: string;
}): Promise<void> {
  if (!(await withinRateLimit(input.contactId))) {
    await sendWhatsappText({
      to: input.waId,
      body: "You've searched a lot in the last hour - please try again shortly.",
    });
    return;
  }

  const [categories, cities] = await Promise.all([listCategories(), listCities()]);
  const resolved = resolveQuery(input.text, categories, cities);

  // Every matched category ("light" should catch both "Lighting" and "String
  // Lights"), plus a direct search of listing titles/descriptions - a listing
  // can be the right answer without its category name literally being what
  // the customer typed. Both run and get merged, not one instead of the other.
  const [byCategory, byText] = await Promise.all([
    Promise.all(
      resolved.categorySlugs.map((categorySlug) =>
        searchListings({ categorySlug, citySlug: resolved.citySlug, limit: RESULT_LIMIT }),
      ),
    ),
    searchListings({ q: resolved.q, citySlug: resolved.citySlug, limit: RESULT_LIMIT }),
  ]);

  const seen = new Set<string>();
  const results: ListingResult[] = [];
  for (const listing of [...byCategory.flat(), ...byText]) {
    if (seen.has(listing.id)) continue;
    seen.add(listing.id);
    results.push(listing);
    if (results.length === RESULT_LIMIT) break;
  }

  if (results.length === 0) {
    await sendWhatsappText({
      to: input.waId,
      body:
        "I couldn't find anything for that. Try something simple, like \"photographer in Abuja\" or \"catering\".",
    });
    return;
  }

  await sendWhatsappList({
    to: input.waId,
    body: `Here's what I found (${results.length}). Tap one to start chatting with the vendor:`,
    rows: results.map((listing) => ({
      id: listing.id,
      title: truncate(listing.title, 24),
      description: truncate(`${priceLabel(listing)} · ${listing.providerName}`, 72),
    })),
  });
}
