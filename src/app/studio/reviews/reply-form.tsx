"use client";

import { useActionState } from "react";
import { replyReviewAction, type FormState } from "@/modules/provider/actions";

export function ReplyForm({ reviewId }: { reviewId: string }) {
  const [state, action, pending] = useActionState(
    replyReviewAction.bind(null, reviewId),
    {} as FormState,
  );

  return (
    <form action={action} className="mt-3 flex gap-2">
      <input
        name="reply"
        placeholder="Reply…"
        required
        className="h-10 flex-1 rounded-lg border border-[color:var(--color-line)] px-3 text-sm outline-none focus:border-[color:var(--color-ink)]"
      />
      <button
        type="submit"
        disabled={pending}
        className="h-10 rounded-lg bg-[color:var(--color-ink)] px-4 text-sm font-medium text-white disabled:opacity-40"
      >
        Reply
      </button>
      {state.error ? <p className="w-full text-xs text-[color:var(--color-danger)]">{state.error}</p> : null}
    </form>
  );
}
