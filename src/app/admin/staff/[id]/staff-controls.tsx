"use client";

import { useTransition } from "react";
import { setStaffRoleAction, setStaffStatusAction } from "@/modules/admin/actions";
import type { StaffRole } from "@/modules/admin/permissions";

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
          className="ml-2 h-9 rounded-lg border border-[color:var(--color-line)] px-3 text-sm"
        >
          {roles.map((r) => (
            <option key={r} value={r}>{roleLabels[r]}</option>
          ))}
        </select>
      </label>

      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => setStaffStatusAction(staffId, status === "active" ? "suspended" : "active"))}
        className="h-9 rounded-lg border border-[color:var(--color-line)] px-3 text-xs font-medium disabled:opacity-40"
      >
        {status === "active" ? "Suspend account" : "Reactivate"}
      </button>
      <span className="text-xs text-[color:var(--color-ink-muted)]">
        Changing the role resets their views to that role&rsquo;s default bundle.
      </span>
    </div>
  );
}
