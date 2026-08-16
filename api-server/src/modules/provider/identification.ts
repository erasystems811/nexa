import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@nexa/db-types/src/types";
import { ProviderError } from "./context.js";

/**
 * Who a vendor actually is. Ported from apps/customer's
 * modules/provider/identification.ts — unchanged. Two *approved* documents,
 * of two different kinds — enforced at the DB (provider_documents has no
 * update policy for its own owner), this module is defense-in-depth.
 */

export const ID_TYPES = [
  { value: "cac", label: "CAC certificate", needsNumber: false },
  { value: "nin", label: "NIN (National Identity Number)", needsNumber: true },
  { value: "bank_bvn", label: "BVN (Bank Verification Number)", needsNumber: true },
  { value: "passport", label: "International passport", needsNumber: true },
  { value: "drivers_licence", label: "Driver's licence", needsNumber: true },
] as const;

export type IdType = (typeof ID_TYPES)[number]["value"];

export function idNeedsNumber(kind: string): boolean {
  return ID_TYPES.find((t) => t.value === kind)?.needsNumber ?? true;
}

export const ACCEPTED_ID_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;
export const REQUIRED_ID_COUNT = 2;

const BUCKET = "provider-media";
const MAX_FILE_BYTES = 10 * 1024 * 1024;

export interface IdSubmission {
  idType: IdType;
  idNumber: string;
  file: File;
}

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

export function isIdentityVerified(documents: IdDocumentRow[]): boolean {
  const approved = new Set(documents.filter((d) => d.status === "approved").map((d) => d.kind));
  return approved.size >= REQUIRED_ID_COUNT;
}

export function validateIdSubmission(submission: IdSubmission): void {
  if (!isIdType(submission.idType)) throw new ProviderError("Choose a means of identification");
  if (idNeedsNumber(submission.idType) && submission.idNumber.trim().length < 4) {
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

/** Writes the file and the row that points at it. The client is the caller's — a public applicant uses the admin client, a signed-in vendor their own RLS-scoped one. */
export async function storeIdDocument(
  db: SupabaseClient<Database>,
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

  const number = submission.idNumber.trim();

  const { error: documentError } = await db.from("provider_documents").insert({
    provider_id: providerId,
    kind: submission.idType,
    storage_path: path,
    status: "pending",
    metadata: {
      id_type: submission.idType,
      id_type_label: idTypeLabel(submission.idType),
      id_number: number || null,
      source,
    },
  });

  if (documentError) {
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
  remainingTypes: Array<{ value: string; label: string; needsNumber: boolean }>;
}

/** What the vendor sees on their own verification page. */
export async function myIdentityStatus(supabase: SupabaseClient<Database>, providerId: string): Promise<IdentityStatus> {
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

  const settled = new Set(rows.filter((d) => d.status !== "rejected").map((d) => d.kind));

  return {
    verified: isIdentityVerified(rows),
    required: REQUIRED_ID_COUNT,
    approvedCount: new Set(rows.filter((d) => d.status === "approved").map((d) => d.kind)).size,
    documents,
    remainingTypes: ID_TYPES.filter((t) => !settled.has(t.value)).map((t) => ({
      value: t.value,
      label: t.label,
      needsNumber: t.needsNumber,
    })),
  };
}

/** The gate itself, asked by anything that could reach a customer. */
export async function providerIsVerified(supabase: SupabaseClient<Database>, providerId: string): Promise<boolean> {
  const { data } = await supabase.from("provider_documents").select("kind, status").eq("provider_id", providerId);
  return isIdentityVerified(data ?? []);
}

export const NOT_VERIFIED_MESSAGE =
  "Nexa has to know who you are before your services can go in front of customers. Upload two means of identification — once Nexa approves them, you can list.";

/** A vendor adding one more document from Business Studio. */
export async function submitIdDocument(
  supabase: SupabaseClient<Database>,
  providerId: string,
  submission: IdSubmission,
): Promise<void> {
  validateIdSubmission(submission);

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
