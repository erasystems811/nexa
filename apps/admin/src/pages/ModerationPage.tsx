import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Card, CardContent } from "@nexa/design-system/src/components/ui/card";
import { apiGet, apiSend } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { can, PERMISSIONS as P } from "../lib/permissions";
import { ActionButton } from "../components/action-button";

interface Flag {
  id: string;
  reason: string;
  excerpt: string;
  status: "pending" | "confirmed" | "dismissed";
  subject_id: string;
  conversation_id: string;
  strike_id: string | null;
  created_at: string;
}

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
export function ModerationPage() {
  const { staff } = useAuth();
  const canView = can(staff, P.moderationView);
  const canResolve = can(staff, P.moderationResolve);
  const canStrike = can(staff, P.moderationStrike);

  const [pending, setPending] = useState<Flag[]>([]);
  const [confirmed, setConfirmed] = useState<Flag[]>([]);

  const load = useCallback(() => {
    if (!canView) return;
    apiGet<Flag[]>("/admin/moderation", { status: "pending" }).then(setPending);
    apiGet<Flag[]>("/admin/moderation", { status: "confirmed" }).then(setConfirmed);
  }, [canView]);

  useEffect(() => {
    load();
  }, [load]);

  if (!staff || !canView) return <Navigate to="/" replace />;

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
                  <p className="text-xs font-medium uppercase tracking-wider text-destructive">
                    {REASON[f.reason] ?? f.reason}
                  </p>
                  <p className="mt-2 text-sm">&ldquo;{f.excerpt}&rdquo;</p>
                  {canResolve ? (
                    <div className="mt-3 flex gap-2">
                      <ActionButton
                        label="Confirm breach"
                        variant="primary"
                        run={async () => {
                          await apiSend("POST", `/admin/moderation/${f.id}/resolve`, { decision: "confirmed" });
                          load();
                        }}
                      />
                      <ActionButton
                        label="False positive"
                        run={async () => {
                          await apiSend("POST", `/admin/moderation/${f.id}/resolve`, { decision: "dismissed" });
                          load();
                        }}
                      />
                    </div>
                  ) : null}
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
                      {canStrike && (f.strike_id || f.status === "confirmed") ? (
                        <ActionButton
                          label="Record as a strike"
                          variant="danger"
                          confirm="Log this as a strike on the account?"
                          run={async () => {
                            await apiSend("POST", `/admin/moderation/${f.id}/strike`);
                            load();
                          }}
                        />
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
