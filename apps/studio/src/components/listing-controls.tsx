import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ListingStatus } from "@nexa/db-types/src/types";
import { apiSend, ApiError } from "../lib/api";

/** Pause, duplicate, delete. */
export function ListingControls({
  listingId,
  status,
  onChanged,
}: {
  listingId: string;
  status: ListingStatus;
  /** Called after a pause/unpause so the caller can refetch and show the new status. */
  onChanged: () => void;
}) {
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pause(paused: boolean) {
    setPending(true);
    setError(null);
    try {
      await apiSend("PATCH", `/provider/listings/${listingId}/pause`, { paused });
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  async function duplicate() {
    setPending(true);
    setError(null);
    try {
      const { id } = await apiSend<{ id: string }>("POST", `/provider/listings/${listingId}/duplicate`);
      navigate(`/listings/${id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong");
      setPending(false);
    }
  }

  async function del() {
    if (!confirm("Delete this listing? This cannot be undone.")) return;
    setPending(true);
    setError(null);
    try {
      await apiSend("DELETE", `/provider/listings/${listingId}`);
      navigate("/listings");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong");
      setPending(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {status === "approved" || status === "paused" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => pause(status !== "paused")}
            className="h-9 rounded-full border border-input px-4 text-xs font-medium disabled:opacity-40"
          >
            {status === "paused" ? "Unpause" : "Pause"}
          </button>
        ) : null}

        <button
          type="button"
          disabled={pending}
          onClick={duplicate}
          className="h-9 rounded-full border border-input px-4 text-xs font-medium disabled:opacity-40"
        >
          Duplicate
        </button>

        <button
          type="button"
          disabled={pending}
          onClick={del}
          className="h-9 rounded-full border border-input px-4 text-xs font-medium text-destructive disabled:opacity-40"
        >
          Delete
        </button>
      </div>
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
