import { notFound } from "next/navigation";
import { getOrderAsAdmin } from "@/modules/bookings";
import { verifyOrderAccessToken } from "@/lib/order-access";
import { formatKobo } from "@/lib/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/status-pill";
import { CancelButton } from "./cancel-button";
import { SetPasswordForm } from "./set-password-form";

/**
 * The no-login door to a booking, for a WhatsApp-only customer who has no
 * password to log in with. This is a link the bot sends, never something
 * typed in - the `t` query param is a signed token, not a session.
 */
export default async function TrackOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { id } = await params;
  const { t } = await searchParams;

  if (!verifyOrderAccessToken(id, t)) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="font-serif text-2xl font-bold text-primary">This link isn&rsquo;t valid</h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              This tracking link has expired or isn&rsquo;t recognised. If you still have the
              conversation open on WhatsApp, ask there for a fresh one.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const result = await getOrderAsAdmin(id);
  if (!result) notFound();

  const { booking, codes } = result;
  const code = codes[0] ?? null;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="font-serif text-2xl font-bold text-primary">{booking.listings.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{booking.providers.business_name}</p>
      </div>

      <div className="flex items-center justify-between">
        <StatusPill status={booking.status} />
        <p className="font-mono text-xs text-muted-foreground">{booking.reference}</p>
      </div>

      {booking.status === "paid_held" ? (
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-sm font-medium">Changed your mind?</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              You can cancel for a full, automatic refund — but only before the vendor accepts or starts
              the job. They haven&rsquo;t accepted yet, so you&rsquo;re still in time.
            </p>
            <div className="mt-3">
              <CancelButton bookingId={booking.id} token={t ?? ""} />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {code ? (
        <Card className="border-primary/30">
          <CardContent className="pt-6">
            <h2 className="text-sm font-medium">Your completion code</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Only you can see this. Give it to the vendor when the job is done and you are happy —
              that is what tells Nexa to pay them. Never share it beforehand.
            </p>

            <div className="mt-4 flex items-center justify-between">
              {code.consumed_at ? (
                <p className="text-[11px] text-emerald-700">Used</p>
              ) : (
                <span />
              )}
              <p
                className={`font-mono text-2xl font-semibold tracking-[0.2em] ${code.consumed_at ? "text-muted-foreground line-through" : ""}`}
              >
                {code.code}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Progress</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ol className="space-y-3 text-sm">
            <Step done={!!booking.accepted_at} label="Vendor accepted the booking" />
            <Step done={booking.status === "in_progress" || !!booking.completed_at} label="Work under way" />
            <Step done={!!booking.completed_at} label="You gave the vendor your completion code" />
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Payment</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Price</dt>
              <dd className="tabular-nums">{formatKobo(booking.agreed_price_kobo)}</dd>
            </div>
            <div className="flex justify-between border-t pt-2 font-medium">
              <dt>Held by Nexa</dt>
              <dd className="tabular-nums">{formatKobo(booking.agreed_price_kobo)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">When</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm">{new Date(booking.scheduled_start).toLocaleString("en-NG")}</p>
          {booking.address ? (
            <p className="mt-1 text-sm text-muted-foreground">{booking.address}</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h2 className="text-sm font-medium">Set a password</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            This link expires eventually. Set a password once, and you can sign back in anytime with
            your WhatsApp number — no link needed.
          </p>
          <div className="mt-3">
            <SetPasswordForm bookingId={booking.id} token={t ?? ""} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Step({ done, label }: { done: boolean; label: string }) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ${done ? "bg-primary text-primary-foreground" : "border border-border"}`}
      >
        {done ? "✓" : ""}
      </span>
      <span className={done ? "" : "text-muted-foreground"}>{label}</span>
    </li>
  );
}
