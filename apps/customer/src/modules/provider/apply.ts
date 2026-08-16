import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { ensureAuthUser } from "@/modules/auth/provisioning";
import { authEmailFor } from "@/modules/auth/identity";
import { ProviderError } from "./context";
import { storeIdDocument, validateIdSet, type IdSubmission } from "./identification";
import { sendApplicationReceived } from "@/modules/email/resend";
import { createClient } from "@/lib/supabase/server";

/**
 * The public vendor application — how a business asks to join Nexa.
 *
 * Nobody is signed in here. Somebody who has never heard of Nexa fills in a form
 * on the open marketplace, so every write is made with the service-role client:
 * an anonymous visitor has no RLS identity that could be allowed to create a
 * providers row, and they must not have one.
 *
 * What it creates, in order:
 *   1. the auth user for their email — reused if that email already has an
 *      account, because a vendor who once booked something as a customer is the
 *      normal case and a second account for that email cannot exist,
 *   2. a providers row with status 'pending' — invisible to the marketplace
 *      until Admin approves it,
 *   3. their category and their contact details,
 *   4. their two means of identification: each file in Storage, and a
 *      provider_documents row pointing at it.
 *
 * Approval is Admin's, in the pending queue that already exists. Approving flips
 * the profile to the provider role (the sync_provider_role trigger), which is
 * what opens Business Studio. Approving the *documents* is a separate act, and
 * it is what lets them put a service in front of a customer — identification.ts.
 */

export interface ApplicationListingInput {
  title: string;
  /**
   * Chosen per item, not once for the whole business — a vendor can sell
   * across several categories (catering AND DJ), so this is where the
   * category actually belongs, the same as it does in Business Studio.
   */
  categoryId: string;
  priceType: "fixed" | "negotiable";
  /** Naira, not kobo — this is a form value, converted at the write. Absent when priceType is "negotiable". */
  priceNaira?: number;
  photo: File;
}

export interface ApplicationInput {
  businessName: string;
  phone: string;
  email: string;
  cityId: string;
  /** Neighborhood-level, e.g. "Wuse", "Maitama" — not a street address. Required, so location search actually works. */
  area: string;
  description: string;
  /** They choose it here, so signing in never depends on an email arriving. */
  password: string;
  /** The business's profile photo — required, shown to customers as its face. */
  profilePhoto: File;
  /** Two, of two different kinds. validateIdSet is what says so. */
  ids: IdSubmission[];
  /**
   * What they're selling, submitted with the application itself. Created as
   * ordinary pending_approval listings — Admin approving the application
   * approves these alongside it, in the same action (see admin/providers.ts
   * approveProviderAndListings), so nothing sits in a second review queue.
   */
  listings: ApplicationListingInput[];
}

// The same public bucket Studio's profile-photo upload uses (0035), so an
// applicant's photo and a later change from Studio live in one place.
const PROFILE_BUCKET = "provider-profile-media";
// Matches media.ts's own BUCKET constant — a listing's photo lives in the same
// private bucket whether it arrived with the application or was added later
// from Studio.
const LISTING_MEDIA_BUCKET = "provider-media";
const ACCEPTED_IMAGE = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function listingSlugify(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "listing"}-${Math.random().toString(36).slice(2, 8)}`;
}

function slugify(businessName: string): string {
  const base = businessName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base || "vendor"}-${Math.random().toString(36).slice(2, 6)}`;
}

function validate(input: ApplicationInput): void {
  if (input.businessName.trim().length < 2) throw new ProviderError("Tell us your business name");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.email.trim())) {
    throw new ProviderError("That email address does not look right");
  }
  if (input.phone.replace(/\D/g, "").length < 10) {
    throw new ProviderError("Enter the phone number customers reach you on");
  }
  if (input.password.length < 8) {
    throw new ProviderError("Choose a password of at least 8 characters");
  }
  if (!input.cityId) throw new ProviderError("Choose the city you work in");
  if (input.area.trim().length < 2) {
    throw new ProviderError("Tell us the area you're in, e.g. Wuse, Maitama, Ide");
  }
  if (input.area.trim().length > 60) {
    throw new ProviderError("Just the area name — not a full street address");
  }
  if (input.description.trim().length < 20) {
    throw new ProviderError("Tell us a little more about your business — a sentence or two");
  }
  if (!input.profilePhoto || input.profilePhoto.size === 0) {
    throw new ProviderError("Add a profile photo for your business");
  }
  if (input.profilePhoto.size > MAX_IMAGE_BYTES) {
    throw new ProviderError("That profile photo is too large. Keep it under 10MB");
  }
  if (!ACCEPTED_IMAGE.includes(input.profilePhoto.type)) {
    throw new ProviderError("The profile photo must be a JPG, PNG or WEBP image");
  }
  validateIdSet(input.ids);

  if (input.listings.length === 0) {
    throw new ProviderError("Add at least one thing you're selling, with a price and a photo");
  }
  for (const listing of input.listings) {
    if (!listing.title.trim()) throw new ProviderError("Every item you're selling needs a title");
    if (!listing.categoryId) throw new ProviderError(`Choose a category for "${listing.title || "each item"}"`);
    if (listing.priceType === "fixed" && (!Number.isFinite(listing.priceNaira) || (listing.priceNaira as number) <= 0)) {
      throw new ProviderError(`"${listing.title || "One of your items"}" needs a price, or mark it negotiable`);
    }
    if (!listing.photo || listing.photo.size === 0) {
      throw new ProviderError(`Add a photo for "${listing.title || "each item"}"`);
    }
    if (listing.photo.size > MAX_IMAGE_BYTES) {
      throw new ProviderError(`The photo for "${listing.title}" is too large. Keep it under 10MB`);
    }
    if (!ACCEPTED_IMAGE.includes(listing.photo.type)) {
      throw new ProviderError(`The photo for "${listing.title}" must be a JPG, PNG or WEBP image`);
    }
  }
}

export async function submitApplication(input: ApplicationInput): Promise<{ providerId: string }> {
  validate(input);

  const db = createAdminClient();
  const email = input.email.trim().toLowerCase();
  const businessName = input.businessName.trim();

  // The vendor account is its own independent login, stored under the tagged
  // vendor address. It is NOT the customer account for this email — the two are
  // separate accounts that happen to share a real email, each with its own
  // password. A customer who already booked here is untouched by applying.
  const { user } = await ensureAuthUser({
    email: authEmailFor("studio", email),
    fullName: businessName,
    password: input.password,
  }).catch((e: unknown) => {
    throw new ProviderError(
      `We could not start your application: ${e instanceof Error ? e.message : "unknown error"}`,
    );
  });

  // providers.user_id is unique — one business per login. Applying twice should
  // say so plainly rather than fail on a constraint.
  const { data: existing } = await db
    .from("providers")
    .select("id, business_name, status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    throw new ProviderError(
      existing.status === "pending"
        ? `${email} has already applied for "${existing.business_name}". We are reviewing it — watch your inbox.`
        : `${email} already runs "${existing.business_name}" on Nexa. Sign in instead.`,
    );
  }

  const { data: provider, error: providerError } = await db
    .from("providers")
    .insert({
      user_id: user.id,
      business_name: businessName,
      slug: slugify(businessName),
      description: input.description.trim(),
      city_id: input.cityId,
      address: input.area.trim(),
      status: "pending",
    })
    .select("id")
    .single();

  if (providerError || !provider) {
    throw new ProviderError(`We could not save your application: ${providerError?.message}`);
  }

  // From here on, anything that fails takes the whole application with it —
  // a provider row with no ID document is a row Admin cannot act on.
  try {
    // One row per distinct category across their submitted listings — a
    // vendor selling both catering and DJ services shows up under both, the
    // same as a vendor who added a second category's listing later would.
    const distinctCategoryIds = [...new Set(input.listings.map((l) => l.categoryId))];
    const { error: categoryError } = await db
      .from("provider_categories")
      .insert(distinctCategoryIds.map((categoryId) => ({ provider_id: provider.id, category_id: categoryId })));
    if (categoryError) throw new ProviderError(categoryError.message);

    // The bootstrap trigger already made the contact row; fill it in.
    const { error: contactError } = await db
      .from("provider_contacts")
      .upsert(
        {
          provider_id: provider.id,
          contact_phone: input.phone.trim(),
          contact_email: email,
        },
        { onConflict: "provider_id" },
      );
    if (contactError) throw new ProviderError(contactError.message);

    // The profile photo goes in the public bucket — it is the business's face,
    // shown to every customer — and its URL becomes the provider's logo.
    const ext = input.profilePhoto.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const photoPath = `${provider.id}/logo.${ext}`;
    const { error: photoError } = await db.storage
      .from(PROFILE_BUCKET)
      .upload(photoPath, input.profilePhoto, { contentType: input.profilePhoto.type, upsert: true });
    if (photoError) throw new ProviderError(`We could not upload your profile photo: ${photoError.message}`);

    const publicUrl = `${db.storage.from(PROFILE_BUCKET).getPublicUrl(photoPath).data.publicUrl}`;
    const { error: logoError } = await db
      .from("providers")
      .update({ logo_url: publicUrl })
      .eq("id", provider.id);
    if (logoError) throw new ProviderError(logoError.message);

    for (const submission of input.ids) {
      await storeIdDocument(db, provider.id, submission, "public_application");
    }

    // Written directly, not through provider/listings.ts's createListing —
    // that function requires an already-verified provider, which this one
    // isn't yet. Same pending_approval status either way; Admin approves it
    // alongside the application (approveProviderAndListings).
    for (const listing of input.listings) {
      const { data: listingRow, error: listingError } = await db
        .from("listings")
        .insert({
          provider_id: provider.id,
          category_id: listing.categoryId,
          title: listing.title.trim(),
          slug: listingSlugify(listing.title),
          price_type: listing.priceType,
          payment_type: "full",
          price_kobo: listing.priceType === "fixed" ? Math.round((listing.priceNaira as number) * 100) : null,
          status: "pending_approval",
        })
        .select("id")
        .single();
      if (listingError || !listingRow) {
        throw new ProviderError(`We could not save "${listing.title}": ${listingError?.message}`);
      }

      const ext = listing.photo.name.split(".").pop()?.toLowerCase() || "jpg";
      const mediaPath = `${provider.id}/${listingRow.id}/${crypto.randomUUID()}.${ext}`;
      const { error: mediaUploadError } = await db.storage
        .from(LISTING_MEDIA_BUCKET)
        .upload(mediaPath, listing.photo, { contentType: listing.photo.type, upsert: false });
      if (mediaUploadError) {
        throw new ProviderError(`We could not upload the photo for "${listing.title}": ${mediaUploadError.message}`);
      }

      const { error: mediaRowError } = await db.from("listing_media").insert({
        listing_id: listingRow.id,
        kind: "image",
        storage_path: mediaPath,
        status: "pending_approval",
      });
      if (mediaRowError) throw new ProviderError(mediaRowError.message);
    }
  } catch (e) {
    await db.from("providers").delete().eq("id", provider.id);
    throw e instanceof ProviderError
      ? e
      : new ProviderError("We could not save your application. Please try again.");
  }


  // Nothing worse than handing over your NIN and hearing nothing back. If Resend
  // is down the application still stands — this must never undo it.
  try {
    await sendApplicationReceived({ to: input.email, businessName: input.businessName });
  } catch {
    // Swallowed on purpose.
  }
  return { providerId: provider.id };
}

/**
 * The signed-in person's own vendor application, if they have one.
 *
 * Read with their own client, so `providers_read_own` is what permits it — a
 * page has no business holding the service role. Returns null for someone who
 * never applied.
 */
export async function myApplication(userId: string): Promise<{ status: string } | null> {
  const supabase = await createClient();

  // Filter by user_id explicitly. RLS alone is not enough here: `providers_public_read`
  // shows every APPROVED vendor to everyone, so an unfiltered select returns the
  // whole marketplace as well as your own row, and maybeSingle() then finds "many"
  // and returns nothing. The applicant would be told they had never applied.
  const { data } = await supabase
    .from("providers")
    .select("status")
    .eq("user_id", userId)
    .maybeSingle();

  return data;
}
