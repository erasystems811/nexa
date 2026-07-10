"use client";

import { useState, useTransition } from "react";
import { togglePermissionAction } from "@/modules/admin/actions";
import type { Permission } from "@/modules/admin/permissions";

/** Per-person view toggles. PRD Addendum §4: permission-based, not role-only. */
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

  const toggle = () =>
    start(async () => {
      const next = !held;
      setHeld(next);
      try {
        await togglePermissionAction(staffId, perm, next);
      } catch {
        setHeld(!next); // revert on failure
      }
    });

  return (
    <li className="flex items-center justify-between py-1.5">
      <span className="text-sm">{label}</span>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={held}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${held ? "bg-[color:var(--color-ink)]" : "bg-[color:var(--color-line)]"}`}
      >
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${held ? "translate-x-6" : "translate-x-1"}`} />
      </button>
    </li>
  );
}
