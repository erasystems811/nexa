import { Card, CardContent } from "@nexa/design-system/src/components/ui/card";
import { useApiQuery } from "../lib/query";
import { useAuth } from "../auth/AuthContext";
import { PERMISSIONS as P, can } from "../lib/permissions";

interface ActivityEntry {
  id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
  profiles: { full_name: string | null } | null;
}

/**
 * The platform activity log. Every action tied to the account that did it,
 * so when several people manage the same view you can see exactly who did
 * what. Each row already carries the actor's name because every admin
 * action writes an audit_log entry under their id.
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

export function ActivityPage() {
  const { staff } = useAuth();
  const { data: feed } = useApiQuery<ActivityEntry[]>(["activity"], "/admin/activity");

  if (!can(staff, P.staffManage)) {
    return <p className="text-sm text-muted-foreground">You do not have permission to view activity.</p>;
  }

  if (!feed) return <div className="text-muted-foreground">Loading…</div>;

  return (
    <>
      <h1 className="font-serif text-2xl font-bold">Activity</h1>
      <p className="mt-1 text-sm text-muted-foreground">Every staff action, tied to the person who did it.</p>

      {feed.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="pt-6 text-sm text-muted-foreground">No activity yet.</CardContent>
        </Card>
      ) : (
        <Card className="mt-6">
          <CardContent className="p-0">
            <ul className="divide-y">
              {feed.map((e) => {
                const who = e.profiles?.full_name ?? "A staff member";
                return (
                  <li key={e.id} className="flex items-baseline justify-between gap-4 px-6 py-2.5">
                    <span className="text-sm">
                      <span className="font-medium">{who}</span> {ACTION_LABELS[e.action] ?? e.action.replace(/_/g, " ")}
                      {e.entity_type ? <span className="text-muted-foreground"> · {e.entity_type}</span> : null}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString("en-NG")}</span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  );
}
