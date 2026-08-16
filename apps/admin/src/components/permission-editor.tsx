import { useState, useTransition } from "react";
import { Switch } from "@nexa/design-system/src/components/ui/switch";
import { apiSend } from "../lib/api";
import type { Permission } from "../lib/permissions";

/** Per-person view toggles. Permission-based, not role-only. */
export function PermissionEditor({
  staffId,
  permissions,
}: {
  staffId: string;
  permissions: { key: Permission; label: string; held: boolean }[];
}) {
  return (
    <ul className="mt-3 space-y-1">
      {permissions.map((p) => (
        <PermissionRow key={p.key} staffId={staffId} perm={p.key} label={p.label} initial={p.held} />
      ))}
    </ul>
  );
}

function PermissionRow({
  staffId,
  perm,
  label,
  initial,
}: {
  staffId: string;
  perm: Permission;
  label: string;
  initial: boolean;
}) {
  const [held, setHeld] = useState(initial);
  const [pending, start] = useTransition();

  const toggle = (next: boolean) =>
    start(async () => {
      setHeld(next);
      try {
        await apiSend("POST", `/admin/staff/${staffId}/permission`, { permission: perm, grant: next });
      } catch {
        setHeld(!next); // revert on failure
      }
    });

  return (
    <li className="flex items-center justify-between py-1.5">
      <span className="text-sm">{label}</span>
      <Switch checked={held} onCheckedChange={toggle} disabled={pending} />
    </li>
  );
}
