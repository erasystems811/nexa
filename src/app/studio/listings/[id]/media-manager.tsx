"use client";

import { useActionState, useTransition } from "react";
import { deleteMediaAction, uploadMediaAction } from "@/modules/provider/actions";
import type { FormState } from "@/modules/provider/actions";

interface Media {
  id: string;
  kind: string;
  status: string;
  url: string | null;
}

/** Media upload./13: every upload enters Pending Approval. */
export function MediaManager({ listingId, media }: { listingId: string; media: Media[] }) {
  const [state, action, pending] = useActionState(
    uploadMediaAction.bind(null, listingId),
    {} as FormState,
  );
  const [deleting, startDelete] = useTransition();

  return (
    <div>
      {media.length > 0 ? (
        <ul className="mb-4 grid grid-cols-3 gap-2">
          {media.map((m) => (
            <li key={m.id} className="relative">
              <div className="aspect-square overflow-hidden rounded-lg bg-[color:var(--color-surface-sunk)]">
                {m.url && m.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element -- signed URL to a private bucket; next/image cannot sign it
                  <img src={m.url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-[color:var(--color-ink-muted)]">
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
                disabled={deleting}
                onClick={() => startDelete(() => deleteMediaAction(m.id, listingId))}
                className="absolute right-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <form action={action} className="flex items-center gap-2">
        <input
          type="file"
          name="file"
          accept="image/*,video/mp4,video/quicktime"
          required
          className="flex-1 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="h-10 shrink-0 rounded-lg bg-[color:var(--color-ink)] px-4 text-sm font-medium text-white disabled:opacity-40"
        >
          {pending ? "Uploading…" : "Upload"}
        </button>
      </form>

      {state.error ? (
        <p className="mt-2 text-xs text-[color:var(--color-danger)]">{state.error}</p>
      ) : null}
      <p className="mt-2 text-xs text-[color:var(--color-ink-muted)]">
        Every upload is reviewed by Admin before it appears publicly.
      </p>
    </div>
  );
}
