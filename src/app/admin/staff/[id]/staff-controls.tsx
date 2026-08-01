"use client";

import { useTransition } from "react";
import { setStaffRoleAction, setStaffStatusAction } from "@/modules/admin/actions";
import type { StaffRole } from "@/modules/admin/permissions";
import { Button } from "@/components/ui/button";

export function StaffControls({
  staffId,
  role,
  status,
  roles,
  roleLabels,
}: {
  staffId: string;
  role: StaffRole;
  status: string;
  roles: StaffRole[];
  roleLabels: Record<StaffRole, string>;
}) {
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="text-xs">
        Role
        <select
          defaultValue={role}
          disabled={pending}
          onChange={(e) => start(() => setStaffRoleAction(staffId, e.target.value as StaffRole))}
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
        onClick={() => start(() => setStaffStatusAction(staffId, status === "active" ? "suspended" : "active"))}
      >
        {status === "active" ? "Suspend account" : "Reactivate"}
      </Button>
      <span className="text-xs text-muted-foreground">Changing the role resets their views to that role&rsquo;s default bundle.</span>
    </div>
  );
}
