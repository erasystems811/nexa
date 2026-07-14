import Link from "next/link";
import type { Route } from "next";
import { requireRole, signOut } from "@/modules/auth";
import { mySubscription, currentProvider, myIdentityStatus } from "@/modules/provider";
import { SubscriptionBanner } from "@/components/subscription-banner";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui";

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

  const tabs = [
    { href: "/", label: "Home" },
    { href: "/listings", label: "Listings" },
    { href: "/orders", label: "Orders" },
    { href: "/wallet", label: "Wallet" },
    { href: "/reviews", label: "Reviews" },
    { href: "/profile", label: "Profile" },
  ] as const;

  return (
    <div className="min-h-dvh bg-[color:var(--color-surface-sunk)] pb-20">
      <header className="border-b border-[color:var(--color-line)] bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-4">
          <Link href="/" aria-label="Business Studio home">
            <Logo label="Business Studio" markClassName="size-8 rounded-xl" textClassName="text-sm" />
          </Link>
          <div className="flex items-center gap-3">
            <form action={signOut}>
              <Button type="submit" variant="ghost" className="h-9 px-4 text-xs">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-5 py-6">
        {subscription ? (
          <SubscriptionBanner status={subscription.status} amountKobo={subscription.amount_kobo} />
        ) : null}

        {identity && !identity.verified ? (
          <Link
            href={"/verification" as Route}
            className="mb-4 block rounded-[var(--radius-card)] bg-amber-50 p-4 hover:bg-amber-100"
          >
            <p className="text-sm font-medium text-amber-900">
              Nexa needs to know who you are
            </p>
            <p className="mt-1 text-xs text-amber-900/80">
              Send {identity.required} means of identification — CAC, NIN, BVN, passport or driver&apos;s
              licence. You have {identity.approvedCount} approved. Until Nexa has both, you cannot put a
              service in front of customers.
            </p>
            <p className="mt-2 text-xs font-medium text-amber-900 underline">Do it now</p>
          </Link>
        ) : null}

        {children}
      </div>

      {/* Mobile-first: a bottom tab bar, the way Section 16 asks. */}
      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-[color:var(--color-line)] bg-white">
        <ul className="mx-auto flex max-w-2xl">
          {tabs.map((t) => (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href as Route}
                className="block py-3 text-center text-[11px] font-medium text-[color:var(--color-ink-muted)]"
              >
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
