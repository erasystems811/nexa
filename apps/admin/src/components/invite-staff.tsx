import { useState, type FormEvent } from "react";
import { Button } from "@nexa/design-system/src/components/ui/button";
import { Card, CardContent } from "@nexa/design-system/src/components/ui/card";
import { Input } from "@nexa/design-system/src/components/ui/input";
import { apiSend, ApiError } from "../lib/api";
import { STAFF_ROLES, STAFF_ROLE_LABELS, type StaffRole } from "../lib/permissions";

interface InviteStaffResult {
  staffId: string;
  warning?: string;
}

export function InviteStaff({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState("");
  const [role, setRole] = useState<StaffRole>(STAFF_ROLES[0]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [warning, setWarning] = useState<string | undefined>(undefined);

  if (!open) {
    return <Button onClick={() => setOpen(true)}>Add a staff member</Button>;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await apiSend<InviteStaffResult>("POST", "/admin/staff", {
        email,
        fullName,
        role,
        department: department || undefined,
      });
      setOk(true);
      setWarning(result.warning);
      onAdded();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={onSubmit}>
          <h2 className="text-sm font-semibold">Add a staff member</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Creates their own login and starts them on the chosen role&rsquo;s views. You can grant extra views
            after. They are emailed a code to set their own password.
          </p>
          <div className="mt-3 space-y-2">
            <Input
              name="full_name"
              placeholder="Full name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
            <Input
              name="email"
              type="email"
              placeholder="Work email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              name="department"
              placeholder="Department (optional)"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            />
            <select
              name="role"
              required
              value={role}
              onChange={(e) => setRole(e.target.value as StaffRole)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {STAFF_ROLES.map((r) => (
                <option key={r} value={r}>
                  {STAFF_ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
          {ok ? (
            <div className="mt-2 space-y-1">
              <p className="text-sm text-emerald-500">
                {warning ? "Staff member added." : "Staff member added. A set-password email is on its way to them."}
              </p>
              {warning ? <p className="text-sm text-destructive">{warning}</p> : null}
            </div>
          ) : null}
          <div className="mt-3 flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add staff"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
