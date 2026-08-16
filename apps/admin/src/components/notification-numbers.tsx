import { useState } from "react";
import { Button } from "@nexa/design-system/src/components/ui/button";
import { Input } from "@nexa/design-system/src/components/ui/input";
import { Label } from "@nexa/design-system/src/components/ui/label";
import { apiSend } from "../lib/api";

interface NotificationNumber {
  id: string;
  phone: string;
  label: string | null;
}

/**
 * Every number listed here gets pinged on WhatsApp the moment a customer
 * types "help" - whoever's on the list checks the request in Support and
 * assigns it, same as a request that came in through the website form.
 */
export function NotificationNumbers({
  numbers,
  onChanged,
}: {
  numbers: NotificationNumber[];
  onChanged: () => void;
}) {
  const [phone, setPhone] = useState("");
  const [label, setLabel] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const trimmedPhone = phone.trim();
    if (!trimmedPhone) {
      setError("Enter a phone number");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await apiSend("POST", "/admin/support/notification-numbers", {
        phone: trimmedPhone,
        label: label.trim() || undefined,
      });
      setPhone("");
      setLabel("");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add that number");
    } finally {
      setPending(false);
    }
  }

  function remove(id: string) {
    setRemoveError(null);
    setRemoving(true);
    apiSend("DELETE", `/admin/support/notification-numbers/${id}`)
      .then(onChanged)
      .catch((e) => setRemoveError(e instanceof Error ? e.message : "Could not remove that number"))
      .finally(() => setRemoving(false));
  }

  return (
    <div>
      <ul className="divide-y divide-border">
        {numbers.map((n) => (
          <li key={n.id} className="flex items-center justify-between gap-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">{n.phone}</p>
              {n.label ? <p className="text-xs text-muted-foreground">{n.label}</p> : null}
            </div>
            <button
              type="button"
              disabled={removing}
              onClick={() => remove(n.id)}
              className="text-xs font-medium text-destructive disabled:opacity-40"
            >
              Remove
            </button>
          </li>
        ))}
        {numbers.length === 0 ? (
          <li className="py-3 text-sm text-muted-foreground">No numbers added yet.</li>
        ) : null}
      </ul>
      {removeError ? <p className="mt-2 text-xs text-destructive">{removeError}</p> : null}

      <form onSubmit={add} className="mt-4 flex flex-wrap items-end gap-2">
        <div>
          <Label className="mb-1 block text-xs font-medium text-muted-foreground">WhatsApp number</Label>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="2348012345678"
            className="h-9 w-40"
          />
        </div>
        <div>
          <Label className="mb-1 block text-xs font-medium text-muted-foreground">Label (optional)</Label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Chidera"
            className="h-9 w-40"
          />
        </div>
        <Button type="submit" size="sm" disabled={pending}>
          Add
        </Button>
      </form>
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
