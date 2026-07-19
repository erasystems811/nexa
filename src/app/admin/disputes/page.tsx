import { redirect } from "next/navigation";
import { currentStaff, can, listStaff, listDisputes, listSupportRequests, PERMISSIONS as P } from "@/modules/admin";
import { Card, PageHeader } from "@/components/ui";
import { DisputeActions } from "./dispute-actions";
import { SupportRequestActions } from "./support-request-actions";

const REASON_LABEL: Record<string, string> = {
  vendor_no_code: "Vendor says the customer won't give the code",
};

const CHANNEL_LABEL: Record<string, string> = {
  web: "Website",
  whatsapp: "WhatsApp",
};

/**
 * Support.
 *
 * Two things land here: a general help request (a question, a problem,
 * however it arrived - the website contact form or typing "help" to the
 * WhatsApp bot), and a dispute (a booking where the money is stuck, and Nexa
 * decides where it goes). Different permissions, same page - most people who
 * handle one end up handling both.
 */
export default async function DisputesPage() {
  const staff = await currentStaff();
  const canSupport = can(staff, P.supportHandle);
  const canDisputes = can(staff, P.disputesView);
  if (!staff || (!canSupport && !canDisputes)) redirect("/admin");

  const [requests, disputes, staffList] = await Promise.all([
    canSupport ? listSupportRequests() : Promise.resolve([]),
    canDisputes ? listDisputes() : Promise.resolve([]),
    canSupport ? listStaff() : Promise.resolve([]),
  ]);

  const staffOptions = staffList.map((s) => ({
    id: s.user_id,
    name: s.profiles?.full_name?.trim() || s.email || "Staff",
  }));

  return (
    <>
      <PageHeader
        title="Support"
        subtitle="Help requests and disputes - a booking where the money is stuck, and you decide where it goes."
      />

      {canSupport ? (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold text-[color:var(--color-ink-muted)]">
            Help requests
          </h2>
          {requests.length === 0 ? (
            <Card className="text-sm text-[color:var(--color-ink-muted)]">Nothing open.</Card>
          ) : (
            <ul className="space-y-3">
              {requests.map((r) => {
                const assignee = (r.profiles as unknown as { full_name: string | null } | null)
                  ?.full_name;
                return (
                  <li key={r.id}>
                    <Card>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{r.name?.trim() || "Someone"}</p>
                          <p className="mt-0.5 text-xs text-[color:var(--color-ink-muted)]">
                            {CHANNEL_LABEL[r.channel] ?? r.channel} · {r.contact}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-[color:var(--color-surface-sunk)] px-2.5 py-1 text-[11px] font-medium">
                          {r.status === "in_progress" ? `With ${assignee ?? "someone"}` : "Open"}
                        </span>
                      </div>

                      <p className="mt-3 rounded-lg bg-[color:var(--color-surface-sunk)] px-3 py-2 text-sm">
                        &ldquo;{r.message}&rdquo;
                      </p>

                      <SupportRequestActions requestId={r.id} staff={staffOptions} />
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}

      {canDisputes ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-[color:var(--color-ink-muted)]">Disputes</h2>
          {disputes.length === 0 ? (
            <Card className="text-sm text-[color:var(--color-ink-muted)]">Nothing open.</Card>
          ) : (
            <ul className="space-y-3">
              {disputes.map((dp) => {
                const booking = dp.bookings as unknown as {
                  id: string;
                  reference: string;
                  providers: { business_name: string } | null;
                  profiles: { full_name: string | null; phone: string | null } | null;
                } | null;
                return (
                  <li key={dp.id}>
                    <Card>
                      <p className="text-sm font-medium">
                        {REASON_LABEL[dp.reason] ?? dp.reason}
                      </p>
                      <p className="mt-0.5 text-xs text-[color:var(--color-ink-muted)]">
                        {booking?.reference} · vendor: {booking?.providers?.business_name ?? "—"}
                      </p>

                      {dp.description ? (
                        <p className="mt-3 rounded-lg bg-[color:var(--color-surface-sunk)] px-3 py-2 text-sm">
                          &ldquo;{dp.description}&rdquo;
                        </p>
                      ) : null}

                      <p className="mt-3 text-xs text-[color:var(--color-ink-muted)]">
                        Customer: {booking?.profiles?.full_name ?? "—"}
                        {booking?.profiles?.phone ? (
                          <>
                            {" · "}
                            <a href={`tel:${booking.profiles.phone}`} className="underline">
                              {booking.profiles.phone}
                            </a>{" "}
                            (call them for the code first)
                          </>
                        ) : null}
                      </p>

                      <DisputeActions disputeId={dp.id} />
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}
    </>
  );
}
