import "server-only";

import { ensureAuthUser, trySendPasswordSetupCode } from "@/modules/auth/provisioning";
import { idTypeLabel, isIdentityVerified, REQUIRED_ID_COUNT } from "@/modules/provider";
import { adminDb, audit, AdminError } from "./context";

/**
 * Vendor management.
 *
 * Approving a vendor means one thing now: they are allowed to sell on Nexa.
 * There are no terms to set at approval — no deposit, no commission, no penalty.
 * Money is decided later, per booking, when an admin pays the vendor.
 *
 * Approving a vendor is not the same as believing who they are. A vendor added
 * here skips the application queue, but not identification: they sign in, they
 * are asked for two means of ID, and nothing of theirs reaches a customer until
 * an admin has looked at both. See decideDocument, below.
 */

export async function listProviders(status?: string) {
  const db = adminDb();
  let q = db
    .from("providers")
    .select("id, business_name, slug, status, is_featured, is_on_probation, strike_count, created_at, cities ( name )")
    .order("created_at", { ascending: false });
  if (status) q = q.eq("status", status as never);
  else q = q.neq("status", "removed");
  const { data } = await q;
  return data ?? [];
}

export async function getProviderDetail(providerId: string) {
  const db = adminDb();

  const [provider, contact, wallet, reliability, listings, bookings, reviews, strikes, payouts] =
    await Promise.all([
      db.from("providers").select("*, cities ( name )").eq("id", providerId).maybeSingle(),
      db.from("provider_contacts").select("contact_phone, contact_email").eq("provider_id", providerId).maybeSingle(),
      db.from("provider_wallets").select("*").eq("provider_id", providerId).maybeSingle(),
      db.from("provider_reliability").select("*").eq("provider_id", providerId).maybeSingle(),
      db.from("listings").select("id, title, status, price_kobo, price_type").eq("provider_id", providerId),
      db.from("bookings").select("id, reference, status, scheduled_start, agreed_price_kobo").eq("provider_id", providerId).order("scheduled_start", { ascending: false }).limit(20),
      db.from("reviews").select("id, quality, punctuality, communication, value, comment, created_at").eq("provider_id", providerId).order("created_at", { ascending: false }).limit(10),
      db.from("provider_strikes").select("*").eq("provider_id", providerId).order("created_at", { ascending: false }),
      db.from("payouts").select("id, amount_kobo, status, paid_at, created_at").eq("provider_id", providerId).order("created_at", { ascending: false }),
    ]);

  if (!provider.data) return null;
  return {
    provider: provider.data,
    contact: contact.data,
    wallet: wallet.data,
    reliability: reliability.data,
    listings: listings.data ?? [],
    bookings: bookings.data ?? [],
    reviews: reviews.data ?? [],
    strikes: strikes.data ?? [],
    payouts: payouts.data ?? [],
    identity: await providerIdentity(providerId),
  };
}

export interface AdminIdDocument {
  id: string;
  kind: string;
  label: string;
  idNumber: string | null;
  status: string;
  notes: string | null;
  source: string | null;
  createdAt: string;
  /** A short-lived link to the private file, so Admin can look at the photo. */
  url: string | null;
}

/**
 * The vendor's means of identification, and whether Nexa believes them.
 *
 * The documents live in a private bucket, so the photo is served through a
 * signed URL minted here rather than a public path — the ID a business sends
 * Nexa is not a thing to leave lying on the open internet.
 */
export async function providerIdentity(providerId: string): Promise<{
  verified: boolean;
  required: number;
  documents: AdminIdDocument[];
}> {
  const db = adminDb();

  const { data } = await db
    .from("provider_documents")
    .select("id, kind, status, notes, metadata, storage_path, created_at")
    .eq("provider_id", providerId)
    .order("created_at");

  const rows = data ?? [];

  const documents = await Promise.all(
    rows.map(async (d) => {
      const metadata = (d.metadata ?? {}) as { id_number?: string; source?: string };
      const { data: signed } = d.storage_path
        ? await db.storage.from("provider-media").createSignedUrl(d.storage_path, 60 * 60)
        : { data: null };

      return {
        id: d.id,
        kind: d.kind,
        label: idTypeLabel(d.kind),
        idNumber: metadata.id_number ?? null,
        status: d.status as string,
        notes: d.notes,
        source: metadata.source ?? null,
        createdAt: d.created_at,
        url: signed?.signedUrl ?? null,
      };
    }),
  );

  return {
    verified: isIdentityVerified(rows),
    required: REQUIRED_ID_COUNT,
    documents,
  };
}

/**
 * Approve or reject one document. The vendor cannot do this to their own — there
 * is no update policy on provider_documents for them at all (0011). It is Admin's
 * word, and the audit log records whose.
 */
export async function decideDocument(
  actorId: string,
  documentId: string,
  approved: boolean,
  notes?: string,
): Promise<void> {
  const db = adminDb();

  const { error } = await db
    .from("provider_documents")
    .update({
      status: approved ? "approved" : "rejected",
      reviewed_by: actorId,
      reviewed_at: new Date().toISOString(),
      notes: notes ?? null,
    })
    .eq("id", documentId);

  if (error) throw new AdminError(error.message);
  await audit(actorId, approved ? "approve_document" : "reject_document", "provider_document", documentId, null, { notes });
}

/**
 * Approve a vendor: mark them approved, and that is all. The DB trigger promotes
 * their profile to the provider role, which unlocks Business Studio for them.
 */
export async function approveProvider(actorId: string, providerId: string): Promise<void> {
  const db = adminDb();

  const { error } = await db
    .from("providers")
    .update({ status: "approved", approved_at: new Date().toISOString(), approved_by: actorId })
    .eq("id", providerId);
  if (error) throw new AdminError(error.message);

  await audit(actorId, "approve_provider", "provider", providerId);
}

export async function rejectProvider(actorId: string, providerId: string, reason: string): Promise<void> {
  const db = adminDb();
  const { error } = await db
    .from("providers")
    .update({ status: "rejected", rejection_reason: reason })
    .eq("id", providerId);
  if (error) throw new AdminError(error.message);
  await audit(actorId, "reject_provider", "provider", providerId, null, { reason });
}

/** Suspension immediately hides all of the provider's listings. */
export async function setProviderSuspended(
  actorId: string,
  providerId: string,
  suspended: boolean,
): Promise<void> {
  const db = adminDb();
  const { error } = await db
    .from("providers")
    .update({ status: suspended ? "suspended" : "approved" })
    .eq("id", providerId);
  if (error) throw new AdminError(error.message);
  await audit(actorId, suspended ? "suspend_provider" : "reinstate_provider", "provider", providerId);
}

export async function setProviderFeatured(actorId: string, providerId: string, featured: boolean): Promise<void> {
  const db = adminDb();
  const { error } = await db.from("providers").update({ is_featured: featured }).eq("id", providerId);
  if (error) throw new AdminError(error.message);
  await audit(actorId, "set_featured", "provider", providerId, null, { featured });
}

export interface ManualProviderResult {
  providerId: string;
  /** Set when the provider exists but could not be told how to sign in. */
  warning?: string;
}

/**
 * Add a vendor by hand. Reuses the auth user when the email already has one — a
 * vendor who first signed up as a customer is the common case — then creates the
 * vendor, already approved, since the vetting was done in person.
 *
 * The account never gets a password from us: the vendor is emailed a code and
 * sets their own at /reset. Without that email the login exists but is unusable,
 * so a send failure comes back as a warning the admin can act on.
 */
export async function addProviderManually(
  actorId: string,
  input: { email: string; businessName: string; cityId?: string | null },
): Promise<ManualProviderResult> {
  const db = adminDb();

  let user;
  try {
    user = (await ensureAuthUser({ email: input.email, fullName: input.businessName })).user;
  } catch (e) {
    throw new AdminError(`Could not create the account: ${e instanceof Error ? e.message : "unknown error"}`);
  }

  // providers.user_id is unique — one business per login.
  const { data: alreadyProvider } = await db
    .from("providers")
    .select("id, business_name")
    .eq("user_id", user.id)
    .maybeSingle();
  if (alreadyProvider) {
    throw new AdminError(`${input.email} already runs "${alreadyProvider.business_name}" on Nexa. Open that vendor instead.`);
  }

  const slug = input.businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Math.random().toString(36).slice(2, 6);

  const { data: provider, error: provErr } = await db
    .from("providers")
    .insert({ user_id: user.id, business_name: input.businessName, slug, city_id: input.cityId ?? null, status: "pending" })
    .select("id")
    .single();
  if (provErr || !provider) throw new AdminError(`Could not create the vendor: ${provErr?.message}`);

  await approveProvider(actorId, provider.id);
  await audit(actorId, "add_provider_manually", "provider", provider.id, null, { email: input.email });

  const warning = await trySendPasswordSetupCode({ email: input.email, name: input.businessName });
  return { providerId: provider.id, warning };
}
