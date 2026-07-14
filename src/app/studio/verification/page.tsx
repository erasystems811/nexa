import {
  requireProvider,
  myIdentityStatus,
  ACCEPTED_ID_MIME_TYPES,
} from "@/modules/provider";
import { Card, PageHeader } from "@/components/ui";
import { VerifyForm } from "./verify-form";

const STATUS_LABEL: Record<string, string> = {
  pending: "With Nexa — we are looking at it",
  approved: "Approved",
  rejected: "Not accepted",
};

/**
 * Who you are, in Business Studio.
 *
 * Every vendor lands here: the business that applied on the open marketplace and
 * the business Nexa added by hand. Nexa is asking the same thing of both.
 */
export default async function VerificationPage() {
  const provider = await requireProvider();
  const identity = await myIdentityStatus(provider.id);

  return (
    <>
      <PageHeader
        title="Prove who you are"
        subtitle={
          identity.verified
            ? "Nexa has what it needs. Your services can go live."
            : `Nexa needs ${identity.required} means of identification before your services can go in front of customers. You have ${identity.approvedCount} approved.`
        }
      />

      {identity.verified ? null : (
        <div className="mb-4 rounded-[var(--radius-card)] bg-amber-50 p-4 text-sm text-amber-900">
          Until then, everything else in Business Studio is yours — your orders, your wallet, your
          profile. It is only listing a service that waits.
        </div>
      )}

      {identity.documents.length > 0 ? (
        <Card className="mb-4">
          <h2 className="text-sm font-semibold">What you have sent</h2>
          <ul className="mt-3 space-y-3">
            {identity.documents.map((doc) => (
              <li key={doc.id} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{doc.label}</p>
                  {doc.idNumber ? (
                    <p className="mt-0.5 font-mono text-xs text-[color:var(--color-ink-muted)]">
                      {doc.idNumber}
                    </p>
                  ) : null}
                  {doc.status === "rejected" && doc.notes ? (
                    <p className="mt-1 text-xs text-[color:var(--color-danger)]">{doc.notes}</p>
                  ) : null}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    doc.status === "approved"
                      ? "bg-emerald-50 text-[color:var(--color-success)]"
                      : doc.status === "rejected"
                        ? "bg-red-50 text-[color:var(--color-danger)]"
                        : "bg-[color:var(--color-surface-sunk)] text-[color:var(--color-ink-muted)]"
                  }`}
                >
                  {STATUS_LABEL[doc.status] ?? doc.status}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <h2 className="text-sm font-semibold">
          {identity.documents.length > 0 ? "Send another" : "Send your first one"}
        </h2>
        <p className="mt-1 text-xs text-[color:var(--color-ink-muted)]">
          A CAC certificate, NIN, BVN, international passport or driver&apos;s licence. Two different
          ones. Only Nexa sees them — never a customer.
        </p>
        <div className="mt-4">
          <VerifyForm
            remainingTypes={identity.remainingTypes}
            acceptedMimeTypes={[...ACCEPTED_ID_MIME_TYPES]}
          />
        </div>
      </Card>
    </>
  );
}
