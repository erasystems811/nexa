import { useTransition } from "react";
import { Button } from "@nexa/design-system/src/components/ui/button";
import { apiSend } from "../lib/api";
import type { StaffRole } from "../lib/permissions";

export function StaffControls({
  staffId,
  role,
  status,
  roles,
  roleLabels,
  onChanged,
}: {
  staffId: string;
  role: StaffRole;
  status: string;
  roles: StaffRole[];
  roleLabels: Record<StaffRole, string>;
  onChanged: () => void;
}) {
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="text-xs">
        Role
        <select
          defaultValue={role}
          disabled={pending}
          onChange={(e) =>
            start(async () => {
              await apiSend("POST", `/admin/staff/${staffId}/role`, { role: e.target.value as StaffRole });
              onChanged();
            })
          }
          className="ml-2 h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {roles.map((r) => (
            <option key={r} value={r}>
              {roleLabels[r]}
            </option>
          ))}
        </select>
      </label>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await apiSend("POST", `/admin/staff/${staffId}/status`, {
              status: status === "active" ? "suspended" : "active",
            });
            onChanged();
          })
        }
      >
        {status === "active" ? "Suspend account" : "Reactivate"}
      </Button>
      <span className="text-xs text-muted-foreground">Changing the role resets their views to that role&rsquo;s default bundle.</span>
    </div>
  );
}
