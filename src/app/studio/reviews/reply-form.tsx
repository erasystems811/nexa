"use client";

import { useActionState } from "react";
import { replyReviewAction, type FormState } from "@/modules/provider/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ReplyForm({ reviewId }: { reviewId: string }) {
  const [state, action, pending] = useActionState(replyReviewAction.bind(null, reviewId), {} as FormState);

  return (
    <form action={action} className="mt-3 flex flex-wrap gap-2">
      <Input name="reply" placeholder="Reply…" required className="h-10 flex-1" />
      <Button type="submit" disabled={pending}>
        Reply
      </Button>
      {state.error ? <p className="w-full text-xs text-destructive">{state.error}</p> : null}
    </form>
  );
}
