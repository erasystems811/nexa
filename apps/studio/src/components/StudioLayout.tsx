import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiGet } from "../lib/api";
import { StudioShell } from "./StudioShell";
import { SubscriptionBanner } from "./subscription-banner";

interface IdentityStatus {
  verified: boolean;
  required: number;
  approvedCount: number;
}

interface Subscription {
  status: string;
  amount_kobo: number;
}

/** Nexa Business Studio. Never "Vendor Portal". */
export function StudioLayout() {
  const { loading, providerLoading, session, provider, signOut } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [identity, setIdentity] = useState<IdentityStatus | null>(null);

  useEffect(() => {
    if (!provider) return;
    apiGet<Subscription | null>("/provider/subscription").then(setSubscription).catch(() => setSubscription(null));
    apiGet<IdentityStatus>("/provider/identity").then(setIdentity).catch(() => setIdentity(null));
  }, [provider]);

  // providerLoading covers the gap right after sign-in where `session` is
  // already set but the /provider/me fetch hasn't resolved yet — without
  // this, the guard below reads "no provider yet" as "not a provider",
  // bounces to /login, which immediately bounces back here since `session`
  // is set, forever (the "Maximum update depth exceeded" bug).
  if (loading || providerLoading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (!session) return <Navigate to="/login" replace />;

  // Signed in, but no provider row for this account. This must NOT redirect
  // to /login — session is valid, so /login would immediately bounce back
  // here, and this state bounces forever ("Maximum update depth exceeded").
  // Signing in again can't fix "no provider row" anyway.
  if (!provider) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
        <p className="text-muted-foreground">This account isn&rsquo;t linked to a vendor business yet.</p>
        <button type="button" onClick={signOut} className="text-sm underline">
          Sign out
        </button>
      </div>
    );
  }

  return (
    <StudioShell
      businessName={provider.business_name ?? "Vendor"}
      onProbation={Boolean(provider.is_on_probation)}
      identityPending={Boolean(identity && !identity.verified)}
      identityCopy={
        identity
          ? `Send ${identity.required} means of identification — CAC, NIN, BVN, passport or driver's licence. You have ${identity.approvedCount} approved. Until Nexa has both, you cannot put a service in front of customers.`
          : undefined
      }
      onSignOut={signOut}
    >
      {subscription ? <SubscriptionBanner status={subscription.status} amountKobo={subscription.amount_kobo} /> : null}
      <Outlet />
    </StudioShell>
  );
}
