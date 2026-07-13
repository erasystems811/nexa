import Link from "next/link";
import type { Route } from "next";
import { requireView, PERMISSIONS as P } from "@/modules/admin";
import {
  listSubscriptions,
  subscriptionOverview,
  SUBSCRIPTION_STATUSES,
  SUBSCRIPTION_STATUS_COPY,
  can,
  currentStaff,
} from "@/modules/admin";
import { markSubscriptionPaidAction, setSubscriptionStatusAction } from "@/modules/admin/actions";
import { formatKobo } from "@/lib/money";
import { Card, PageHeader } from "@/components/ui";
import { ActionButton } from "../action-button";

/**
 * The monthly platform fee — one of Nexa's two revenue lines (the other is
 * commission, which collects itself out of escrow).
 *
 * A vendor who lapses is hidden from the marketplace by RLS, not by anything on
 * this page. This screen exists so a person can see WHO has lapsed, why they
 * vanished from search, and put them back.
 */
export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireView(P.subscriptionsView);
  const staff = await currentStaff();
  const canManage = can(staff, P.subscriptionsManage);

  const { status } = await searchParams;
  const [subs, overview] = await Promise.all([listSubscriptions(status), subscriptionOverview()]);

  return (
    <>
      <PageHeader
        title="Subscriptions"
        subtitle="Vendors pay a monthly fee to stay listed. Lapse it and their listings leave the marketplace."
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Paying" value={String(overview.active)} />
        <Stat label="Past due" value={String(overview.pastDue)} tone={overview.pastDue > 0 ? "warn" : undefined} />
        <Stat label="Monthly recurring" value={formatKobo(overview.monthlyKobo)} />
        <Stat label="Collected this month" value={formatKobo(overview.collectedThisMonth)} />
      </div>

      <div className="mb-4 mt-5 flex flex-wrap gap-2">
        <FilterLink label="All" href={"/subscriptions" as Route} active={!status} />
        {SUBSCRIPTION_STATUSES.map((s) => (
          <FilterLink
            key={s}
            label={SUBSCRIPTION_STATUS_COPY[s].label}
            href={`/subscriptions?status=${s}` as Route}
            active={status === s}
          />
        ))}
      </div>

      <ul className="space-y-2">
        {subs.map((s) => {
          const copy = SUBSCRIPTION_STATUS_COPY[s.status];
          const provider = s.providers as unknown as { business_name: string } | null;
          return (
            <li key={s.provider_id}>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link href={`/providers/${s.provider_id}` as Route} className="text-sm font-medium hover:underline">
                      {provider?.business_name ?? "Unknown vendor"}
                    </Link>
                    <p className="mt-0.5 text-xs text-[color:var(--color-ink-muted)]">{copy.meaning}</p>
                    <p className="mt-1 text-xs text-[color:var(--color-ink-muted)]">
                      {formatKobo(s.amount_kobo)}/month
                      {s.current_period_end
                        ? ` · paid up to ${new Date(s.current_period_end).toLocaleDateString("en-NG")}`
                        : " · never billed"}
                    </p>
                  </div>

                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                      copy.visible
                        ? "bg-[color:var(--color-surface-sunk)]"
                        : "bg-amber-50 text-amber-900"
                    }`}
                  >
                    {copy.label}
                    {copy.visible ? "" : " · hidden"}
                  </span>
                </div>

                {canManage ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <ActionButton
                      label="Record payment"
                      variant="primary"
                      confirm="Mark this vendor paid for the coming month? Their listings go back on the marketplace."
                      run={markSubscriptionPaidAction.bind(null, s.provider_id)}
                    />
                    {s.status !== "past_due" ? (
                      <ActionButton
                        label="Mark past due"
                        variant="danger"
                        confirm="Mark past due? Their listings are hidden from customers immediately."
                        run={setSubscriptionStatusAction.bind(null, s.provider_id, "past_due")}
                      />
                    ) : null}
                    {s.status !== "cancelled" ? (
                      <ActionButton
                        label="Cancel"
                        variant="danger"
                        confirm="Cancel this subscription? Their listings are hidden until it is restarted."
                        run={setSubscriptionStatusAction.bind(null, s.provider_id, "cancelled")}
                      />
                    ) : null}
                  </div>
                ) : null}
              </Card>
            </li>
          );
        })}

        {subs.length === 0 ? (
          <Card className="text-sm text-[color:var(--color-ink-muted)]">
            No subscriptions here. Every approved vendor gets one automatically.
          </Card>
        ) : null}
      </ul>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <Card>
      <p className="text-xs text-[color:var(--color-ink-muted)]">{label}</p>
      <p
        className={`mt-1 text-xl font-semibold tabular-nums ${tone === "warn" ? "text-[color:var(--color-danger)]" : ""}`}
      >
        {value}
      </p>
    </Card>
  );
}

function FilterLink({ label, href, active }: { label: string; href: Route; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1.5 text-xs ${active ? "border-[color:var(--color-ink)] bg-[color:var(--color-ink)] text-white" : "border-[color:var(--color-line)]"}`}
    >
      {label}
    </Link>
  );
}
