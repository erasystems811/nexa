import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { ProviderError } from "./context";

/**
 * Who a vendor actually is.
 *
 * Every vendor gives Nexa two means of identification, whoever let them in: the
 * business that applied at /apply, and the business an Admin added by hand.
 * Admin can wave someone past the queue — it cannot wave them past this.
 *
 * The rule is two *approved* documents, not two uploaded ones. Uploading proves
 * nothing; a human at Nexa looking at the photo is the whole point. Until then
 * the vendor keeps Business Studio — their orders, their wallet, their profile —
 * but cannot put a service in front of a customer.
 *
 * The vendor cannot approve their own document even if this file were wrong
 * about it: provider_documents has select and insert for the owner and no
 * update at all (0011). The status is Admin's to write, and nobody else's.
 */

/** The identification a Nigerian business can actually produce. */
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

/** Two, and they must be two different documents. */
export const REQUIRED_ID_COUNT = 2;

const BUCKET = "provider-media";
const MAX_FILE_BYTES = 10 * 1024 * 1024;

export interface IdSubmission {
  idType: IdType;
  idNumber: string;
  file: File;
}

/** A document row as both Studio and Admin need to read it. */
export interface IdDocumentRow {
  kind: string;
  status: string;
}

export function isIdType(value: string): value is IdType {
  return ID_TYPES.some((t) => t.value === value);
}

export function idTypeLabel(kind: string): string {
  return ID_TYPES.find((t) => t.value === kind)?.label ?? kind;
}

/**
 * The one place the rule lives. Both Studio and Admin fetch the rows with their
 * own client — Studio through RLS, Admin through the service role — and ask
 * this. Two approved documents, of two different kinds.
 */
export function isIdentityVerified(documents: IdDocumentRow[]): boolean {
  const approved = new Set(
    documents.filter((d) => d.status === "approved").map((d) => d.kind),
  );
  return approved.size >= REQUIRED_ID_COUNT;
}

export function validateIdSubmission(submission: IdSubmission): void {
  if (!isIdType(submission.idType)) throw new ProviderError("Choose a means of identification");
  if (submission.idNumber.trim().length < 4) {
    throw new ProviderError("Enter the number on your ID");
  }
  if (!submission.file || submission.file.size === 0) {
    throw new ProviderError("Attach a photo of your ID");
  }
  if (submission.file.size > MAX_FILE_BYTES) {
    throw new ProviderError("That file is too large. Keep the photo under 10MB");
  }
  if (!(ACCEPTED_ID_MIME_TYPES as readonly string[]).includes(submission.file.type)) {
    throw new ProviderError("Attach a photo of your ID — a JPG, PNG or WEBP image");
  }
}

/** The set a new application must arrive with: two, and two different ones. */
export function validateIdSet(submissions: IdSubmission[]): void {
  if (submissions.length < REQUIRED_ID_COUNT) {
    throw new ProviderError(`Nexa needs ${REQUIRED_ID_COUNT} means of identification`);
  }
  submissions.forEach(validateIdSubmission);

  const kinds = new Set(submissions.map((s) => s.idType));
  if (kinds.size < submissions.length) {
    throw new ProviderError("Choose two different means of identification — not the same one twice");
  }
}

/**
 * Writes the file and the row that points at it.
 *
 * The client is the caller's, deliberately. A public applicant has no identity
 * at all and must be written with the service role; a vendor uploading from
 * Studio has one, and goes through RLS like everything else in Studio does. The
 * path starts with the provider id either way, which is what the storage policy
 * checks — no vendor can write into another vendor's folder.
 */
export async function storeIdDocument(
  db: SupabaseClient,
  providerId: string,
  submission: IdSubmission,
  source: "public_application" | "studio",
): Promise<void> {
  const ext = submission.file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${providerId}/identification/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await db.storage
    .from(BUCKET)
    .upload(path, submission.file, { contentType: submission.file.type, upsert: false });

  if (uploadError) throw new ProviderError(`We could not upload your ID: ${uploadError.message}`);

  const { error: documentError } = await db.from("provider_documents").insert({
    provider_id: providerId,
    kind: submission.idType,
    storage_path: path,
    status: "pending",
    metadata: {
      id_type: submission.idType,
      id_type_label: idTypeLabel(submission.idType),
      id_number: submission.idNumber.trim(),
      source,
    },
  });

  if (documentError) {
    // The row failed, so the orphaned file should not linger.
    await db.storage.from(BUCKET).remove([path]);
    throw new ProviderError(`We could not record your ID: ${documentError.message}`);
  }
}

export interface IdentityStatus {
  verified: boolean;
  required: number;
  approvedCount: number;
  documents: Array<{
    id: string;
    kind: string;
    label: string;
    idNumber: string | null;
    status: string;
    notes: string | null;
    createdAt: string;
  }>;
  /** Types they have not submitted yet, for the upload form. */
  remainingTypes: Array<{ value: string; label: string }>;
}

/** What the vendor sees on their own verification page. */
export async function myIdentityStatus(providerId: string): Promise<IdentityStatus> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("provider_documents")
    .select("id, kind, status, notes, metadata, created_at")
    .eq("provider_id", providerId)
    .order("created_at");

  const rows = data ?? [];
  const documents = rows.map((d) => ({
    id: d.id,
    kind: d.kind,
    label: idTypeLabel(d.kind),
    idNumber: (d.metadata as { id_number?: string } | null)?.id_number ?? null,
    status: d.status as string,
    notes: d.notes,
    createdAt: d.created_at,
  }));

  // A rejected document is worth re-submitting; a pending or approved one is not.
  const settled = new Set(
    rows.filter((d) => d.status !== "rejected").map((d) => d.kind),
  );

  return {
    verified: isIdentityVerified(rows),
    required: REQUIRED_ID_COUNT,
    approvedCount: new Set(rows.filter((d) => d.status === "approved").map((d) => d.kind)).size,
    documents,
    remainingTypes: ID_TYPES.filter((t) => !settled.has(t.value)).map((t) => ({
      value: t.value,
      label: t.label,
    })),
  };
}

/** The gate itself, asked by anything in Studio that could reach a customer. */
export async function providerIsVerified(providerId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("provider_documents")
    .select("kind, status")
    .eq("provider_id", providerId);

  return isIdentityVerified(data ?? []);
}

export const NOT_VERIFIED_MESSAGE =
  "Nexa has to know who you are before your services can go in front of customers. Upload two means of identification — once Nexa approves them, you can list.";

/** A vendor adding one more document from Business Studio. */
export async function submitIdDocument(
  providerId: string,
  submission: IdSubmission,
): Promise<void> {
  validateIdSubmission(submission);

  const supabase = await createClient();

  // One live document per kind. A rejected one may be replaced; a pending or
  // approved one is already doing its job.
  const { data: existing } = await supabase
    .from("provider_documents")
    .select("status")
    .eq("provider_id", providerId)
    .eq("kind", submission.idType);

  const live = (existing ?? []).find((d) => d.status !== "rejected");
  if (live) {
    throw new ProviderError(
      live.status === "approved"
        ? `Nexa has already approved your ${idTypeLabel(submission.idType)}. Send a different kind of ID.`
        : `Your ${idTypeLabel(submission.idType)} is already with Nexa. We are looking at it.`,
    );
  }

  await storeIdDocument(supabase, providerId, submission, "studio");
}
