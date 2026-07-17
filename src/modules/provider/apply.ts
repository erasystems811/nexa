import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { ensureAuthUser } from "@/modules/auth/provisioning";
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

export interface ApplicationInput {
  businessName: string;
  phone: string;
  email: string;
  categoryId: string;
  cityId: string;
  description: string;
  /** They choose it here, so signing in never depends on an email arriving. */
  password: string;
  /** The business's profile photo — required, shown to customers as its face. */
  profilePhoto: File;
  /** Two, of two different kinds. validateIdSet is what says so. */
  ids: IdSubmission[];
}

const PROFILE_BUCKET = "provider-public";
const ACCEPTED_IMAGE = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

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
  if (!input.categoryId) throw new ProviderError("Choose the service you offer");
  if (!input.cityId) throw new ProviderError("Choose the city you work in");
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
}

export async function submitApplication(input: ApplicationInput): Promise<{ providerId: string }> {
  validate(input);

  const db = createAdminClient();
  const email = input.email.trim().toLowerCase();
  const businessName = input.businessName.trim();

  const { user } = await ensureAuthUser({
    email,
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
    const { error: categoryError } = await db
      .from("provider_categories")
      .insert({ provider_id: provider.id, category_id: input.categoryId });
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
    const photoPath = `${provider.id}/profile.${ext}`;
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
