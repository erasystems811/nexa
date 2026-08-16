import { useState, type FormEvent } from "react";
import { Card, CardContent } from "@nexa/design-system/src/components/ui/card";
import { apiSend, ApiError } from "../lib/api";

interface Block {
  id: string;
  starts_at: string;
  ends_at: string;
  note: string | null;
}

/**
 * "Booked" is derived from live bookings and shown read-only — the provider
 * cannot un-book a paid slot from here. Only "Unavailable" blocks are theirs to
 * add and remove.
 */
export function AvailabilityManager({
  listingId,
  blocks,
  booked,
  onChanged,
}: {
  listingId: string;
  blocks: Block[];
  booked: Array<{ start: string; end: string | null }>;
  /** Called after a block is added or removed so the caller can refetch. */
  onChanged: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const date = String(new FormData(form).get("date") ?? "");
    if (!date) {
      setError("Pick a date");
      return;
    }

    setPending(true);
    setError(null);
    try {
      await apiSend("POST", `/provider/listings/${listingId}/availability`, {
        startsAt: new Date(`${date}T00:00`).toISOString(),
        endsAt: new Date(`${date}T23:59`).toISOString(),
      });
      form.reset();
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  async function remove(blockId: string) {
    setRemovingId(blockId);
    try {
      await apiSend("DELETE", `/provider/availability/${blockId}`);
      onChanged();
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <h2 className="mb-3 text-sm font-semibold">Block a date as unavailable</h2>
          <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2">
            <label className="flex-1">
              <span className="mb-1 block text-xs text-muted-foreground">Date</span>
              <input name="date" type="date" required className="h-10 w-full rounded-lg border border-input px-3 text-sm" />
            </label>
            <button
              type="submit"
              disabled={pending}
              className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-40"
            >
              Block
            </button>
          </form>
          {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
        </CardContent>
      </Card>

      {booked.length > 0 ? (
        <Card>
          <CardContent className="pt-6">
            <h2 className="mb-2 text-sm font-semibold">Booked</h2>
            <ul className="space-y-1 text-sm">
              {booked.map((b, i) => (
                <li key={i} className="text-muted-foreground">
                  {new Date(b.start).toLocaleDateString("en-NG")} — booked
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {blocks.length > 0 ? (
        <Card>
          <CardContent className="pt-6">
            <h2 className="mb-2 text-sm font-semibold">Unavailable</h2>
            <ul className="space-y-2 text-sm">
              {blocks.map((b) => (
                <li key={b.id} className="flex items-center justify-between">
                  <span>{new Date(b.starts_at).toLocaleDateString("en-NG")}</span>
                  <button
                    type="button"
                    disabled={removingId === b.id}
                    onClick={() => remove(b.id)}
                    className="text-xs text-destructive disabled:opacity-40"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
