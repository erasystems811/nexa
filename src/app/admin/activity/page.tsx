import { requireView, activityFeed, PERMISSIONS as P } from "@/modules/admin";
import { Card, PageHeader } from "@/components/ui";

/**
 * The platform activity log. PRD Addendum §4 + the founder's requirement: every
 * action tied to the account that did it, so when several people manage the same
 * view you can see exactly who did what. Each row already carries the actor's
 * name because every admin action writes an audit_log entry under their id.
 */
const ACTION_LABELS: Record<string, string> = {
  approve_provider: "approved a provider",
  reject_provider: "rejected a provider",
  suspend_provider: "suspended a provider",
  reinstate_provider: "reinstated a provider",
  remove_provider: "removed a provider",
  set_featured: "changed featured status",
  add_provider_manually: "added a provider",
  record_no_show: "recorded a no-show",
  appeal_upheld: "upheld an appeal",
  appeal_failed: "failed an appeal",
  verify_rider: "verified a rider",
  reject_rider: "rejected a rider",
  suspend_rider: "suspended a rider",
  reassign_delivery: "reassigned a delivery",
  listing_approved: "approved a listing",
  listing_rejected: "rejected a listing",
  listing_changes_requested: "requested listing changes",
  listing_hidden: "hid a listing",
  listing_restored: "restored a listing",
  override_booking_status: "overrode a booking status",
  apply_penalty: "applied a penalty",
  refund: "issued a refund",
  resolve_caution_claim: "resolved a caution claim",
  dispute_resolved: "resolved a dispute",
  dispute_rejected: "rejected a dispute",
  flag_confirmed: "confirmed a flag",
  flag_dismissed: "dismissed a flag",
  flag_to_strike: "converted a flag to a strike",
  invite_staff: "added a staff member",
  set_staff_role: "changed a staff role",
  grant_permission: "granted a permission",
  revoke_permission: "revoked a permission",
  suspend_staff: "suspended a staff account",
  reactivate_staff: "reactivated a staff account",
};

export default async function ActivityPage() {
  await requireView(P.staffManage);
  const feed = await activityFeed(200);

  return (
    <>
      <PageHeader title="Activity" subtitle="Every staff action, tied to the person who did it." />

      {feed.length === 0 ? (
        <Card className="text-sm text-[color:var(--color-ink-muted)]">No activity yet.</Card>
      ) : (
        <Card>
          <ul className="divide-y divide-[color:var(--color-line)]">
            {feed.map((e) => {
              const who = (e.profiles as unknown as { full_name: string | null } | null)?.full_name ?? "A staff member";
              return (
                <li key={e.id} className="flex items-baseline justify-between gap-4 py-2.5">
                  <span className="text-sm">
                    <span className="font-medium">{who}</span>{" "}
                    {ACTION_LABELS[e.action] ?? e.action.replace(/_/g, " ")}
                    {e.entity_type ? <span className="text-[color:var(--color-ink-muted)]"> · {e.entity_type}</span> : null}
                  </span>
                  <span className="shrink-0 text-xs text-[color:var(--color-ink-muted)]">
                    {new Date(e.created_at).toLocaleString("en-NG")}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}
