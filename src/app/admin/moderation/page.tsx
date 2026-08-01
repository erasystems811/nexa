import { requireView, PERMISSIONS as P } from "@/modules/admin";
import { listFlags } from "@/modules/admin";
import { flagToStrikeAction, resolveFlagAction } from "@/modules/admin/actions";
import { Card, CardContent } from "@/components/ui/card";
import { ActionButton } from "../action-button";

const REASON: Record<string, string> = {
  phone_number: "Phone number",
  bank_account: "Bank account",
  off_platform_solicitation: "Off-platform solicitation",
};

/**
 * Flagged-conversation queue. The message was delivered — flagging never
 * blocks. Confirming records it; converting to a strike is the
 * anti-poaching consequence, the same structure as a no-show.
 */
export default async function ModerationPage() {
  await requireView(P.moderationView);
  const [pending, confirmed] = await Promise.all([listFlags("pending"), listFlags("confirmed")]);

  return (
    <>
      <h1 className="font-serif text-2xl font-bold">Flagged messages</h1>
      <p className="mt-1 text-sm text-muted-foreground">Delivered, not blocked. You decide what it means.</p>

      <h2 className="mb-2 mt-6 font-serif text-lg font-semibold">Pending review</h2>
      {pending.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">Nothing pending.</CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {pending.map((f) => (
            <li key={f.id}>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-xs font-medium uppercase tracking-wider text-destructive">{REASON[f.reason] ?? f.reason}</p>
                  <p className="mt-2 text-sm">&ldquo;{f.excerpt}&rdquo;</p>
                  <div className="mt-3 flex gap-2">
                    <ActionButton label="Confirm breach" variant="primary" run={resolveFlagAction.bind(null, f.id, "confirmed")} />
                    <ActionButton label="False positive" run={resolveFlagAction.bind(null, f.id, "dismissed")} />
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {confirmed.length > 0 ? (
        <>
          <h2 className="mb-2 mt-6 font-serif text-lg font-semibold">Confirmed — convert to a strike?</h2>
          <ul className="space-y-3">
            {confirmed.map((f) => (
              <li key={f.id}>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm">&ldquo;{f.excerpt}&rdquo;</p>
                    <div className="mt-3">
                      {f.strike_id || f.status === "confirmed" ? (
                        <ActionButton label="Record as a strike" variant="danger" confirm="Log this as a strike on the account?" run={flagToStrikeAction.bind(null, f.id)} />
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </>
  );
}
