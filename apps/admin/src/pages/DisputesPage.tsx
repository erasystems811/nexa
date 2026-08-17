import { Navigate, Link, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@nexa/design-system/src/components/ui/card";
import { apiSend } from "../lib/api";
import { useApiQuery } from "../lib/query";
import { useAuth } from "../auth/AuthContext";
import { can, PERMISSIONS as P } from "../lib/permissions";
import { ActionButton } from "../components/action-button";

interface SupportRequest {
  id: string;
  channel: string;
  name: string | null;
  contact: string;
  message: string;
  status: "open" | "in_progress" | "resolved";
  assigned_to: string | null;
  created_at: string;
  resolved_at: string | null;
  profiles: { full_name: string | null } | null;
}

interface Dispute {
  id: string;
  reason: string;
  description: string | null;
  status: string;
  created_at: string;
  bookings: {
    id: string;
    reference: string;
    providers: { business_name: string } | null;
    profiles: { full_name: string | null; phone: string | null } | null;
  } | null;
}

const DISPUTE_FILTERS = [
  { label: "Open", value: undefined },
  { label: "Resolved", value: "resolved" },
  { label: "Rejected", value: "rejected" },
] as const;

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
export function DisputesPage() {
  const { staff } = useAuth();
  const canSupport = can(staff, P.supportHandle);
  const canDisputes = can(staff, P.disputesView);
  const canResolveDisputes = can(staff, P.disputesResolve);

  const [searchParams] = useSearchParams();
  const status = searchParams.get("status") ?? undefined;
  const queryClient = useQueryClient();

  const requestsKey = ["support-requests"] as const;
  const { data: requestsData } = useApiQuery<SupportRequest[]>(requestsKey, "/admin/support", undefined, {
    enabled: canSupport,
  });
  const requests = requestsData ?? [];

  const disputesKey = ["disputes", status] as const;
  const { data: disputesData } = useApiQuery<Dispute[]>(
    disputesKey,
    "/admin/disputes",
    status ? { status } : undefined,
    { enabled: canDisputes },
  );
  const disputes = disputesData ?? [];

  const loadRequests = () => queryClient.invalidateQueries({ queryKey: requestsKey });
  const loadDisputes = () => queryClient.invalidateQueries({ queryKey: disputesKey });

  if (!staff || (!canSupport && !canDisputes)) return <Navigate to="/" replace />;

  return (
    <>
      <h1 className="font-serif text-2xl font-bold">Support</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Help requests and disputes — a booking where the money is stuck, and you decide where it goes.
      </p>

      {canSupport ? (
        <section className="mb-8 mt-6">
          <h2 className="mb-3 font-serif text-lg font-semibold">Help requests</h2>
          {requests.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-sm text-muted-foreground">Nothing open.</CardContent>
            </Card>
          ) : (
            <ul className="space-y-3">
              {requests.map((r) => {
                const assignee = r.profiles?.full_name;
                return (
                  <li key={r.id}>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">{r.name?.trim() || "Someone"}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {CHANNEL_LABEL[r.channel] ?? r.channel} · {r.contact}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium">
                            {r.status === "in_progress" ? `With ${assignee ?? "someone"}` : "Open"}
                          </span>
                        </div>

                        <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm">&ldquo;{r.message}&rdquo;</p>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <ActionButton
                            label="Assign to me"
                            run={async () => {
                              await apiSend("POST", `/admin/support/${r.id}/assign`, { assigneeId: staff.userId });
                              loadRequests();
                            }}
                          />
                          <ActionButton
                            label="Mark resolved"
                            variant="primary"
                            run={async () => {
                              await apiSend("POST", `/admin/support/${r.id}/resolve`);
                              loadRequests();
                            }}
                          />
                        </div>
                      </CardContent>
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
          <h2 className="mb-3 font-serif text-lg font-semibold">Disputes</h2>
          <div className="mb-4 flex flex-wrap gap-2">
            {DISPUTE_FILTERS.map((f) => (
              <Link
                key={f.label}
                to={f.value ? `/disputes?status=${f.value}` : "/disputes"}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  status === f.value
                    ? "border-accent bg-accent text-accent-foreground"
                    : "hover:border-muted-foreground"
                }`}
              >
                {f.label}
              </Link>
            ))}
          </div>
          {disputes.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-sm text-muted-foreground">Nothing open.</CardContent>
            </Card>
          ) : (
            <ul className="space-y-3">
              {disputes.map((dp) => {
                const booking = dp.bookings;
                return (
                  <li key={dp.id}>
                    <Card className="border-l-4 border-l-destructive">
                      <CardContent className="pt-6">
                        <p className="text-sm font-medium">{REASON_LABEL[dp.reason] ?? dp.reason}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {booking?.reference} · vendor: {booking?.providers?.business_name ?? "—"}
                        </p>

                        {dp.description ? (
                          <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm">&ldquo;{dp.description}&rdquo;</p>
                        ) : null}

                        <p className="mt-3 text-xs text-muted-foreground">
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

                        {canResolveDisputes ? (
                          <div className="mt-4 flex flex-wrap items-center gap-2">
                            <ActionButton
                              label="Pay the vendor"
                              variant="primary"
                              prompt="Pay the vendor without a code? Add a note for the record:"
                              run={async (note) => {
                                await apiSend("POST", `/admin/disputes/${dp.id}/pay-vendor`, { note });
                                loadDisputes();
                              }}
                            />
                            <ActionButton
                              label="Refund the customer"
                              variant="danger"
                              prompt="Refund the customer? Add a note for the record:"
                              run={async (note) => {
                                await apiSend("POST", `/admin/disputes/${dp.id}/refund-customer`, { note });
                                loadDisputes();
                              }}
                            />
                          </div>
                        ) : null}
                      </CardContent>
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
