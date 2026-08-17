import { useState, type FormEvent } from "react";
import { apiSend, apiUpload, ApiError } from "../lib/api";

interface Media {
  id: string;
  kind: string;
  status: string;
  url: string | null;
}

/** Media upload. Every upload enters Pending Approval. */
export function MediaManager({
  listingId,
  media,
  live = false,
  onChanged,
}: {
  listingId: string;
  media: Media[];
  /** True when the listing is live: a new photo takes it offline for re-approval. */
  live?: boolean;
  /** Called after an upload or delete so the caller can refetch the list. */
  onChanged: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const input = form.elements.namedItem("file") as HTMLInputElement | null;
    const files = input?.files ? Array.from(input.files) : [];
    if (files.length === 0) {
      setError("Choose at least one file");
      return;
    }
    if (
      live &&
      !window.confirm(
        `This listing is live. Adding ${files.length > 1 ? "these photos" : "a photo"} sends it back to Nexa for approval, and it stays hidden from customers until Nexa approves it again. Upload anyway?`,
      )
    ) {
      return;
    }

    setPending(true);
    setError(null);
    try {
      // One at a time, not Promise.all: the server processes each upload
      // (storage write + a moderation row) independently, and firing them
      // all at once risks the same rate limits a human clicking upload
      // ten times fast would hit.
      for (const file of files) {
        await apiUpload(`/provider/listings/${listingId}/media`, file);
      }
      form.reset();
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  async function remove(mediaId: string) {
    setDeletingId(mediaId);
    try {
      await apiSend("DELETE", `/provider/media/${mediaId}`);
      onChanged();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      {media.length > 0 ? (
        <ul className="mb-4 grid grid-cols-3 gap-2">
          {media.map((m) => (
            <li key={m.id} className="relative">
              <div className="aspect-square overflow-hidden rounded-lg bg-muted">
                {m.url && m.kind === "image" ? (
                  // signed URL to a private bucket
                  <img src={m.url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    {m.kind}
                  </div>
                )}
              </div>
              {m.status !== "approved" ? (
                <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
                  Pending
                </span>
              ) : null}
              <button
                type="button"
                disabled={deletingId === m.id}
                onClick={() => remove(m.id)}
                className="absolute right-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <form onSubmit={onSubmit} className="flex items-center gap-2">
        <input type="file" name="file" accept="image/*,video/mp4,video/quicktime" required className="flex-1 text-sm" />
        <button
          type="submit"
          disabled={pending}
          className="h-10 shrink-0 rounded-lg bg-primary px-4 text-sm font-medium text-white disabled:opacity-40"
        >
          {pending ? "Uploading…" : "Upload"}
        </button>
      </form>

      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
      <p className="mt-2 text-xs text-muted-foreground">Every upload is reviewed by Admin before it appears publicly.</p>
    </div>
  );
}
