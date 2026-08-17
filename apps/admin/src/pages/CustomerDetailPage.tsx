import { useParams } from "react-router-dom";
import { formatKobo } from "@nexa/money";
import { Card, CardContent } from "@nexa/design-system/src/components/ui/card";
import { useApiQuery } from "../lib/query";
import { useAuth } from "../auth/AuthContext";
import { PERMISSIONS as P, can } from "../lib/permissions";
import { StatusPill } from "../components/status-pill";

interface CustomerProfile {
  id: string;
  full_name: string | null;
  phone: string | null;
}

interface CustomerBooking {
  id: string;
  reference: string;
  status: string;
  scheduled_start: string;
  agreed_price_kobo: number;
  providers: { business_name: string } | null;
}

interface CustomerDispute {
  id: string;
  reason: string;
  status: string;
  created_at: string;
}

interface CustomerDetail {
  profile: CustomerProfile;
  bookings: CustomerBooking[];
  disputes: CustomerDispute[];
}

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { staff } = useAuth();
  const { data: result, error } = useApiQuery<CustomerDetail>(
    ["customer", id],
    `/admin/customers/${id}`,
    undefined,
    { enabled: Boolean(id) },
  );

  if (!can(staff, P.customersView)) {
    return <p className="text-sm text-muted-foreground">You do not have permission to view customers.</p>;
  }

  if (error) return <p className="text-sm text-muted-foreground">That customer does not exist.</p>;
  if (!result) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const { profile, bookings, disputes } = result;

  return (
    <>
      <h1 className="font-serif text-2xl font-bold">{profile.full_name ?? "Customer"}</h1>
      {profile.phone ? <p className="mt-1 text-sm text-muted-foreground">{profile.phone}</p> : null}

      <Card className="mt-6">
        <CardContent className="pt-6">
          <h2 className="text-sm font-semibold">Booking history ({bookings.length})</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {bookings.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  {b.providers?.business_name} <StatusPill status={b.status as never} />
                </span>
                <span className="tabular-nums text-muted-foreground">{formatKobo(b.agreed_price_kobo)}</span>
              </li>
            ))}
            {bookings.length === 0 ? <li className="text-muted-foreground">No bookings.</li> : null}
          </ul>
        </CardContent>
      </Card>

      {disputes.length > 0 ? (
        <Card className="mt-3">
          <CardContent className="pt-6">
            <h2 className="text-sm font-semibold">Complaints &amp; disputes</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {disputes.map((dp) => (
                <li key={dp.id} className="flex justify-between">
                  <span>{dp.reason}</span>
                  <span className="text-muted-foreground">{dp.status}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
