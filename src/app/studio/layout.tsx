import { requireRole, signOut } from "@/modules/auth";
import { mySubscription, currentProvider, myIdentityStatus } from "@/modules/provider";
import { SubscriptionBanner } from "@/components/subscription-banner";
import { VendorShell } from "@/components/shells";

/** Nexa Business Studio. Never "Vendor Portal". */
export default async function StudioLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireRole("provider");
  const subscription = await mySubscription();

  // Nexa asks every vendor who they are — the ones who applied, and the ones an
  // admin added. Nobody reaches a customer until it has an answer.
  const provider = await currentProvider();
  const identity = provider ? await myIdentityStatus(provider.id) : null;

  return (
    <VendorShell
      businessName={provider?.business_name ?? "Vendor"}
      onProbation={Boolean(provider?.is_on_probation)}
      identityPending={Boolean(identity && !identity.verified)}
      identityCopy={
        identity
          ? `Send ${identity.required} means of identification — CAC, NIN, BVN, passport or driver's licence. You have ${identity.approvedCount} approved. Until Nexa has both, you cannot put a service in front of customers.`
          : undefined
      }
      signOutAction={signOut}
    >
      {subscription ? (
        <SubscriptionBanner status={subscription.status} amountKobo={subscription.amount_kobo} />
      ) : null}
      {children}
    </VendorShell>
  );
}
