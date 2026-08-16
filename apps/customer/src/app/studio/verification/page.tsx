import { requireProvider, myIdentityStatus, ACCEPTED_ID_MIME_TYPES } from "@/modules/provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
      <h1 className="font-serif text-2xl font-bold">Prove who you are</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {identity.verified
          ? "Nexa has what it needs. Your services can go live."
          : `Nexa needs ${identity.required} means of identification before your services can go in front of customers. You have ${identity.approvedCount} approved.`}
      </p>

      {identity.verified ? null : (
        <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          Until then, everything else in Business Studio is yours — your orders, your wallet, your profile. It is
          only listing a service that waits.
        </div>
      )}

      {identity.documents.length > 0 ? (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-sm">What you have sent</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="space-y-3">
              {identity.documents.map((doc) => (
                <li key={doc.id} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{doc.label}</p>
                    {doc.idNumber ? <p className="mt-0.5 font-mono text-xs text-muted-foreground">{doc.idNumber}</p> : null}
                    {doc.status === "rejected" && doc.notes ? (
                      <p className="mt-1 text-xs text-destructive">{doc.notes}</p>
                    ) : null}
                  </div>
                  <Badge
                    variant={doc.status === "approved" ? "default" : doc.status === "rejected" ? "destructive" : "secondary"}
                    className="shrink-0"
                  >
                    {STATUS_LABEL[doc.status] ?? doc.status}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-sm">{identity.documents.length > 0 ? "Send another" : "Send your first one"}</CardTitle>
          <p className="text-xs text-muted-foreground">
            A CAC certificate, NIN, BVN, international passport or driver&apos;s licence. Two different ones. Only
            Nexa sees them — never a customer.
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          <VerifyForm remainingTypes={identity.remainingTypes} acceptedMimeTypes={[...ACCEPTED_ID_MIME_TYPES]} />
        </CardContent>
      </Card>
    </>
  );
}
