import { requireRole } from "@/modules/auth";
import { listFlags } from "@/modules/admin";
import { flagToStrikeAction, resolveFlagAction } from "@/modules/admin/actions";
import { Card, PageHeader } from "@/components/ui";
import { ActionButton } from "../action-button";

const REASON: Record<string, string> = {
  phone_number: "Phone number",
  bank_account: "Bank account",
  off_platform_solicitation: "Off-platform solicitation",
};

/**
 * Flagged-conversation queue. PRD Section 08. The message was delivered —
 * flagging never blocks. Confirming records it; converting to a strike is the
 * anti-poaching consequence, the same structure as a no-show.
 */
export default async function ModerationPage() {
  await requireRole("admin");
  const [pending, confirmed] = await Promise.all([listFlags("pending"), listFlags("confirmed")]);

  return (
    <>
      <PageHeader title="Flagged messages" subtitle="Delivered, not blocked. You decide what it means." />

      <h2 className="mb-2 text-sm font-semibold">Pending review</h2>
      {pending.length === 0 ? (
        <Card className="text-sm text-[color:var(--color-ink-muted)]">Nothing pending.</Card>
      ) : (
        <ul className="space-y-3">
          {pending.map((f) => (
            <li key={f.id}>
              <Card>
                <p className="text-xs font-medium uppercase tracking-wider text-[color:var(--color-danger)]">
                  {REASON[f.reason] ?? f.reason}
                </p>
                <p className="mt-2 text-sm">&ldquo;{f.excerpt}&rdquo;</p>
                <div className="mt-3 flex gap-2">
                  <ActionButton label="Confirm breach" variant="primary" run={() => resolveFlagAction(f.id, "confirmed")} />
                  <ActionButton label="False positive" run={() => resolveFlagAction(f.id, "dismissed")} />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {confirmed.length > 0 ? (
        <>
          <h2 className="mb-2 mt-6 text-sm font-semibold">Confirmed — convert to a strike?</h2>
          <ul className="space-y-3">
            {confirmed.map((f) => (
              <li key={f.id}>
                <Card>
                  <p className="text-sm">&ldquo;{f.excerpt}&rdquo;</p>
                  <div className="mt-3">
                    {f.strike_id || f.status === "confirmed" ? (
                      <ActionButton label="Record as a strike" variant="danger" confirm="Log this as a strike on the account?" run={() => flagToStrikeAction(f.id)} />
                    ) : null}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </>
  );
}
