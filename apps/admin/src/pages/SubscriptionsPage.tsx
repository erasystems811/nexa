import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { formatKobo } from "@nexa/money";
import { Card, CardContent } from "@nexa/design-system/src/components/ui/card";
import { apiGet, apiSend } from "../lib/api";
import { ActionButton } from "../components/action-button";
import { useAuth } from "../auth/AuthContext";
import { PERMISSIONS as P, can } from "../lib/permissions";

type SubscriptionStatus = "trialing" | "active" | "past_due" | "cancelled";

const SUBSCRIPTION_STATUSES: SubscriptionStatus[] = ["trialing", "active", "past_due", "cancelled"];

/** What each status means for the marketplace — the sentence Admin actually needs. */
const SUBSCRIPTION_STATUS_COPY: Record<SubscriptionStatus, { label: string; meaning: string; visible: boolean }> = {
  trialing: {
    label: "Trial",
    meaning: "Signed up, never billed yet. Still visible to customers.",
    visible: true,
  },
  active: {
    label: "Paid",
    meaning: "Paid up for the current period. Visible to customers.",
    visible: true,
  },
  past_due: {
    label: "Past due",
    meaning: "The period ended unpaid — hidden from the marketplace until it is paid.",
    visible: false,
  },
  cancelled: {
    label: "Cancelled",
    meaning: "Ended, by the vendor or by Admin — hidden from the marketplace.",
    visible: false,
  },
};

interface Subscription {
  provider_id: string;
  status: SubscriptionStatus;
  amount_kobo: number;
  current_period_end: string | null;
  providers: { business_name: string } | null;
}

interface SubscriptionOverview {
  active: number;
  pastDue: number;
  monthlyKobo: number;
  collectedThisMonth: number;
}

/**
 * The monthly platform fee — one of Nexa's two revenue lines (the other is
 * commission, which collects itself out of escrow).
 *
 * A vendor who lapses is hidden from the marketplace by RLS, not by anything on
 * this page. This screen exists so a person can see WHO has lapsed, why they
 * vanished from search, and put them back.
 */
export function SubscriptionsPage() {
  const { staff } = useAuth();
  const canView = can(staff, P.subscriptionsView);
  const canManage = can(staff, P.subscriptionsManage);

  const [params] = useSearchParams();
  const status = params.get("status") ?? undefined;

  const [subs, setSubs] = useState<Subscription[] | null>(null);
  const [overview, setOverview] = useState<SubscriptionOverview | null>(null);

  const reload = useCallback(() => {
    apiGet<Subscription[]>("/admin/subscriptions", status ? { status } : undefined).then(setSubs);
    apiGet<SubscriptionOverview>("/admin/subscriptions/overview").then(setOverview);
  }, [status]);

  useEffect(() => {
    if (!canView) return;
    reload();
  }, [canView, reload]);

  if (!canView) {
    return <p className="text-sm text-muted-foreground">You do not have permission to view this page.</p>;
  }

  if (!subs || !overview) return <div className="text-muted-foreground">Loading…</div>;

  return (
    <>
      <h1 className="font-serif text-2xl font-bold">Subscriptions</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Vendors pay a monthly fee to stay listed. Lapse it and their listings leave the marketplace.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        <Stat label="Paying" value={String(overview.active)} />
        <Stat label="Past due" value={String(overview.pastDue)} tone={overview.pastDue > 0 ? "warn" : undefined} />
        <Stat label="Monthly recurring" value={formatKobo(overview.monthlyKobo)} />
        <Stat label="Collected this month" value={formatKobo(overview.collectedThisMonth)} />
      </div>

      <div className="mb-4 mt-5 flex flex-wrap gap-2">
        <FilterLink label="All" to="/subscriptions" active={!status} />
        {SUBSCRIPTION_STATUSES.map((s) => (
          <FilterLink
            key={s}
            label={SUBSCRIPTION_STATUS_COPY[s].label}
            to={`/subscriptions?status=${s}`}
            active={status === s}
          />
        ))}
      </div>

      <ul className="space-y-2">
        {subs.map((s) => {
          const copy = SUBSCRIPTION_STATUS_COPY[s.status];
          const provider = s.providers;
          return (
            <li key={s.provider_id}>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Link to={`/providers/${s.provider_id}`} className="text-sm font-medium hover:underline">
                        {provider?.business_name ?? "Unknown vendor"}
                      </Link>
                      <p className="mt-0.5 text-xs text-muted-foreground">{copy.meaning}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatKobo(s.amount_kobo)}/month
                        {s.current_period_end
                          ? ` · paid up to ${new Date(s.current_period_end).toLocaleDateString("en-NG")}`
                          : " · never billed"}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                        copy.visible ? "bg-muted" : "bg-amber-50 text-amber-900"
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
                        run={async () => {
                          await apiSend<{ ok: boolean }>("POST", `/admin/providers/${s.provider_id}/subscription/mark-paid`);
                          reload();
                        }}
                      />
                      {s.status !== "past_due" ? (
                        <ActionButton
                          label="Mark past due"
                          variant="danger"
                          confirm="Mark past due? Their listings are hidden from customers immediately."
                          run={async () => {
                            await apiSend<{ ok: boolean }>(
                              "POST",
                              `/admin/providers/${s.provider_id}/subscription/status`,
                              { status: "past_due" },
                            );
                            reload();
                          }}
                        />
                      ) : null}
                      {s.status !== "cancelled" ? (
                        <ActionButton
                          label="Cancel"
                          variant="danger"
                          confirm="Cancel this subscription? Their listings are hidden until it is restarted."
                          run={async () => {
                            await apiSend<{ ok: boolean }>(
                              "POST",
                              `/admin/providers/${s.provider_id}/subscription/status`,
                              { status: "cancelled" },
                            );
                            reload();
                          }}
                        />
                      ) : null}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </li>
          );
        })}

        {subs.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">
              No subscriptions here. Every approved vendor gets one automatically.
            </CardContent>
          </Card>
        ) : null}
      </ul>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`mt-1 text-xl font-semibold tabular-nums ${tone === "warn" ? "text-destructive" : ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function FilterLink({ label, to, active }: { label: string; to: string; active: boolean }) {
  return (
    <Link
      to={to}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
        active ? "border-accent bg-accent text-accent-foreground" : "hover:border-muted-foreground"
      }`}
    >
      {label}
    </Link>
  );
}
