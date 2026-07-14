import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { ensureAuthUser } from "@/modules/auth/provisioning";
import { ProviderError } from "./context";

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
 *   4. the means of identification: the file in Storage, and a provider_documents
 *      row pointing at it.
 *
 * Approval is Admin's, in the pending queue that already exists. Approving flips
 * the profile to the provider role (the sync_provider_role trigger), which is
 * what opens Business Studio.
 */

/**
 * The identification a Nigerian business can actually produce.
 *
 * provider_documents.kind is a plain `text` column — 0004 lists a vocabulary in
 * a comment but adds no check constraint, so these values are all legal. Three
 * of them ('cac', 'nin', 'bank_bvn') are that documented vocabulary; a passport
 * and a driver's licence had no name yet, so they get one. The human-readable
 * type and the ID number also go into `metadata`, so nothing is lost if the
 * vocabulary is ever tightened.
 */
export const ID_TYPES = [
  { value: "cac", label: "CAC certificate" },
  { value: "nin", label: "NIN (National Identity Number)" },
  { value: "bank_bvn", label: "BVN (Bank Verification Number)" },
  { value: "passport", label: "International passport" },
  { value: "drivers_licence", label: "Driver's licence" },
] as const;

export type IdType = (typeof ID_TYPES)[number]["value"];

/**
 * The provider-media bucket (0018) accepts images and short video, not PDFs. A
 * photo of the document is what a vendor on a phone actually has anyway.
 */
export const ACCEPTED_ID_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

const BUCKET = "provider-media";
const MAX_FILE_BYTES = 10 * 1024 * 1024;

export interface ApplicationInput {
  businessName: string;
  phone: string;
  email: string;
  categoryId: string;
  cityId: string;
  description: string;
  idType: IdType;
  idNumber: string;
  idFile: File;
}

function isIdType(value: string): value is IdType {
  return ID_TYPES.some((t) => t.value === value);
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
  if (!input.categoryId) throw new ProviderError("Choose the service you offer");
  if (!input.cityId) throw new ProviderError("Choose the city you work in");
  if (input.description.trim().length < 20) {
    throw new ProviderError("Tell us a little more about your business — a sentence or two");
  }
  if (!isIdType(input.idType)) throw new ProviderError("Choose a means of identification");
  if (input.idNumber.trim().length < 4) throw new ProviderError("Enter the number on your ID");
  if (!input.idFile || input.idFile.size === 0) {
    throw new ProviderError("Attach a photo of your ID");
  }
  if (input.idFile.size > MAX_FILE_BYTES) {
    throw new ProviderError("That file is too large. Keep the photo under 10MB");
  }
  if (!(ACCEPTED_ID_MIME_TYPES as readonly string[]).includes(input.idFile.type)) {
    throw new ProviderError("Attach a photo of your ID — a JPG, PNG or WEBP image");
  }
}

export async function submitApplication(input: ApplicationInput): Promise<{ providerId: string }> {
  validate(input);

  const db = createAdminClient();
  const email = input.email.trim().toLowerCase();
  const businessName = input.businessName.trim();

  const { user } = await ensureAuthUser({ email, fullName: businessName }).catch((e: unknown) => {
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

    await storeIdDocument(provider.id, input);
  } catch (e) {
    await db.from("providers").delete().eq("id", provider.id);
    throw e instanceof ProviderError
      ? e
      : new ProviderError("We could not save your application. Please try again.");
  }

  return { providerId: provider.id };
}

/**
 * The ID file lands under the provider's own id prefix, which is the path
 * convention every storage policy in 0018 checks — so once Admin approves them,
 * the vendor can still see what they submitted, and no other vendor ever can.
 */
async function storeIdDocument(providerId: string, input: ApplicationInput): Promise<void> {
  const db = createAdminClient();

  const ext = input.idFile.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${providerId}/identification/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await db.storage
    .from(BUCKET)
    .upload(path, input.idFile, { contentType: input.idFile.type, upsert: false });

  if (uploadError) {
    throw new ProviderError(`We could not upload your ID: ${uploadError.message}`);
  }

  const label = ID_TYPES.find((t) => t.value === input.idType)?.label ?? input.idType;

  const { error: documentError } = await db.from("provider_documents").insert({
    provider_id: providerId,
    kind: input.idType,
    storage_path: path,
    status: "pending",
    metadata: {
      id_type: input.idType,
      id_type_label: label,
      id_number: input.idNumber.trim(),
      source: "public_application",
    },
  });

  if (documentError) {
    // The row failed, so the orphaned file should not linger.
    await db.storage.from(BUCKET).remove([path]);
    throw new ProviderError(`We could not record your ID: ${documentError.message}`);
  }
}
