import Link from "next/link";
import { requireSession } from "@/modules/auth";
import { currentRider, listQueue } from "@/modules/rider";
import { formatKobo } from "@/lib/money";
import { Card, PageHeader } from "@/components/ui";
import { RegisterForm } from "./register-form";

const STATUS_LABEL: Record<string, string> = {
  assigned: "New — accept or decline",
  accepted: "Accepted",
  picked_up: "Picked up",
  en_route: "En route",
  arrived: "Arrived",
  delivered: "Delivered",
  returned: "Returned",
};

/**
 * Rider App entry. PRD Section 15.
 *
 * Not gated to the rider role in middleware, because a pending applicant is
 * still a customer until Admin approves them. The page itself branches on the
 * rider's status.
 */
export default async function RiderHome() {
  await requireSession();
  const rider = await currentRider();

  if (!rider) {
    return (
      <main className="mx-auto max-w-md px-5 py-10">
        <PageHeader title="Ride for Nexa" subtitle="Deliver event supplies. Get paid per job." />
        <RegisterForm />
      </main>
    );
  }

  if (rider.status !== "approved") {
    return (
      <main className="mx-auto max-w-md px-5 py-10">
        <PageHeader title="Application received" />
        <Card>
          <p className="text-sm">
            Your rider account is <strong>{rider.status}</strong>. Nexa verifies every
            rider before assigning deliveries, the same as providers. We&rsquo;ll be in touch.
          </p>
        </Card>
      </main>
    );
  }

  const queue = await listQueue(rider.id);
  const active = queue.filter((a) => !["delivered", "returned"].includes(a.status));

  return (
    <main className="mx-auto max-w-md px-5 py-8">
      <div className="mb-6 flex items-center justify-between">
        <PageHeader title="Deliveries" />
        <Link href="/rider/earnings" className="text-sm underline">
          Earnings
        </Link>
      </div>

      {active.length === 0 ? (
        <Card className="text-sm text-[color:var(--color-ink-muted)]">
          No deliveries in your queue right now.
        </Card>
      ) : (
        <ul className="space-y-3">
          {active.map((a) => {
            const b = a.bookings;
            return (
              <li key={a.id}>
                <Link href={`/rider/${a.id}`}>
                  <Card>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{b.listings.title}</p>
                        <p className="mt-0.5 text-xs text-[color:var(--color-ink-muted)]">
                          {a.leg === 2 ? "Return pickup" : "Delivery"} ·{" "}
                          {new Date(b.scheduled_start).toLocaleDateString("en-NG")}
                        </p>
                        <p className="mt-1 text-[11px] text-[color:var(--color-ink-muted)]">
                          {STATUS_LABEL[a.status] ?? a.status}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-medium tabular-nums">
                        {formatKobo(a.fee_share_kobo)}
                      </p>
                    </div>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
