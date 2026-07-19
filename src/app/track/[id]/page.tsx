import { notFound } from "next/navigation";
import { getOrderAsAdmin } from "@/modules/bookings";
import { verifyOrderAccessToken } from "@/lib/order-access";
import { formatKobo } from "@/lib/money";
import { Card, PageHeader } from "@/components/ui";
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
      <main className="mx-auto max-w-2xl px-5 py-8">
        <PageHeader title="This link isn't valid" />
        <Card>
          <p className="text-sm text-[color:var(--color-ink-muted)]">
            This tracking link has expired or isn&rsquo;t recognised. If you still have the
            conversation open on WhatsApp, ask there for a fresh one.
          </p>
        </Card>
      </main>
    );
  }

  const result = await getOrderAsAdmin(id);
  if (!result) notFound();

  const { booking, codes } = result;
  const code = codes[0] ?? null;

  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <PageHeader title={booking.listings.title} subtitle={booking.providers.business_name} />

      <div className="flex items-center justify-between">
        <StatusPill status={booking.status} />
        <p className="font-mono text-xs text-[color:var(--color-ink-muted)]">{booking.reference}</p>
      </div>

      {booking.status === "paid_held" ? (
        <Card className="mt-4">
          <h2 className="text-sm font-medium">Changed your mind?</h2>
          <p className="mt-1 text-xs text-[color:var(--color-ink-muted)]">
            You can cancel for a full, automatic refund — but only before the vendor accepts or starts
            the job. They haven&rsquo;t accepted yet, so you&rsquo;re still in time.
          </p>
          <div className="mt-3">
            <CancelButton bookingId={booking.id} token={t ?? ""} />
          </div>
        </Card>
      ) : null}

      {code ? (
        <section className="mt-6">
          <Card className="border-[color:var(--color-ink)]">
            <h2 className="text-sm font-medium">Your completion code</h2>
            <p className="mt-1 text-xs text-[color:var(--color-ink-muted)]">
              Only you can see this. Give it to the vendor when the job is done and you are happy —
              that is what tells Nexa to pay them. Never share it beforehand.
            </p>

            <div className="mt-4 flex items-center justify-between">
              {code.consumed_at ? (
                <p className="text-[11px] text-[color:var(--color-success)]">Used</p>
              ) : (
                <span />
              )}
              <p
                className={`font-mono text-2xl font-semibold tracking-[0.2em] ${code.consumed_at ? "text-[color:var(--color-ink-muted)] line-through" : ""}`}
              >
                {code.code}
              </p>
            </div>
          </Card>
        </section>
      ) : null}

      <Card className="mt-4">
        <h2 className="text-sm font-medium">Progress</h2>
        <ol className="mt-3 space-y-3 text-sm">
          <Step done={!!booking.accepted_at} label="Vendor accepted the booking" />
          <Step done={booking.status === "in_progress" || !!booking.completed_at} label="Work under way" />
          <Step done={!!booking.completed_at} label="You gave the vendor your completion code" />
        </ol>
      </Card>

      <Card className="mt-4">
        <h2 className="text-sm font-medium">Payment</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <Row label="Price" value={formatKobo(booking.agreed_price_kobo)} />
          <div className="flex justify-between border-t border-[color:var(--color-line)] pt-2 font-medium">
            <dt>Held by Nexa</dt>
            <dd className="tabular-nums">{formatKobo(booking.agreed_price_kobo)}</dd>
          </div>
        </dl>
      </Card>

      <Card className="mt-4">
        <h2 className="text-sm font-medium">When</h2>
        <p className="mt-1 text-sm">{new Date(booking.scheduled_start).toLocaleString("en-NG")}</p>
        {booking.address ? (
          <p className="mt-1 text-sm text-[color:var(--color-ink-muted)]">{booking.address}</p>
        ) : null}
      </Card>

      <Card className="mt-4">
        <h2 className="text-sm font-medium">Set a password</h2>
        <p className="mt-1 text-xs text-[color:var(--color-ink-muted)]">
          This link expires eventually. Set a password once, and you can sign back in anytime with
          your WhatsApp number — no link needed.
        </p>
        <div className="mt-3">
          <SetPasswordForm bookingId={booking.id} token={t ?? ""} />
        </div>
      </Card>
    </main>
  );
}

function Step({ done, label }: { done: boolean; label: string }) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ${done ? "bg-[color:var(--color-ink)] text-white" : "border border-[color:var(--color-line)]"}`}
      >
        {done ? "✓" : ""}
      </span>
      <span className={done ? "" : "text-[color:var(--color-ink-muted)]"}>{label}</span>
    </li>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-[color:var(--color-ink-muted)]">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
