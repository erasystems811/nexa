import { requireRole } from "@/modules/auth";
import { listPendingFlags } from "@/modules/messaging";
import { Card, PageHeader } from "@/components/ui";
import { FlagActions } from "./flag-actions";

const REASON_LABEL: Record<string, string> = {
  phone_number: "Phone number",
  bank_account: "Bank account",
  off_platform_solicitation: "Off-platform solicitation",
};

/**
 * PRD Section 08. The queue is deliberately a human's job: the scanner has
 * false positives by design, and a confirmed flag is a Provider Agreement
 * breach with a strike behind it.
 */
export default async function ModerationPage() {
  const { profile } = await requireRole("admin");
  const flags = await listPendingFlags({ role: profile.role });

  return (
    <>
      <PageHeader
        title="Moderation"
        subtitle="Messages that mentioned contact or payment details. The message was delivered — flagging never blocks."
      />

      {flags.length === 0 ? (
        <Card className="text-sm text-[color:var(--color-ink-muted)]">
          Nothing pending review.
        </Card>
      ) : (
        <ul className="space-y-3">
          {flags.map((flag) => (
            <li key={flag.id}>
              <Card>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wider text-[color:var(--color-danger)]">
                      {REASON_LABEL[flag.reason] ?? flag.reason}
                    </p>
                    <p className="mt-2 text-sm">&ldquo;{flag.excerpt}&rdquo;</p>
                    <p className="mt-2 font-mono text-[11px] text-[color:var(--color-ink-muted)]">
                      sender {flag.subjectId.slice(0, 8)} ·{" "}
                      {new Date(flag.createdAt).toLocaleString("en-NG")}
                    </p>
                  </div>
                </div>

                <FlagActions flagId={flag.id} />
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Card className="mt-6">
        <p className="text-xs leading-relaxed text-[color:var(--color-ink-muted)]">
          Confirming records the attempt against the sender. It does not create a
          strike — permanent consequences stay an Admin judgment call made with the
          full history in view (PRD Section 05).
        </p>
      </Card>
    </>
  );
}
