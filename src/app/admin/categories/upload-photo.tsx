"use client";

import { useActionState, useState } from "react";
import { setCategoryImageAction, type AdminActionState } from "@/modules/admin/actions";
import { Alert } from "@/components/ui";

const initialState: AdminActionState = {};
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * One category, one photo. Choosing a file submits it — there is no second
 * button to press, because there is nothing else to decide.
 *
 * The size is checked here, before anything is sent. A file past the server's
 * limit is rejected by the framework before the action runs, and that rejection
 * is not something the action can catch — it took the whole page down with it.
 * Stopping an over-size file at the door turns that crash into a plain message.
 */
export function UploadPhoto({ slug, hasPhoto }: { slug: string; hasPhoto: boolean }) {
  const action = setCategoryImageAction.bind(null, slug);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [tooBig, setTooBig] = useState(false);

  return (
    <form action={formAction} className="mt-3">
      <label className="block cursor-pointer">
        <span className="inline-flex h-9 items-center rounded-lg border border-[color:var(--color-line)] px-3 text-xs font-medium hover:bg-[color:var(--color-surface-sunk)]">
          {pending ? "Uploading…" : hasPhoto ? "Replace photo" : "Upload a photo"}
        </span>
        <input
          type="file"
          name="photo"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="sr-only"
          disabled={pending}
          onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            if (file && file.size > MAX_BYTES) {
              setTooBig(true);
              e.currentTarget.value = "";
              return;
            }
            setTooBig(false);
            e.currentTarget.form?.requestSubmit();
          }}
        />
      </label>

      {tooBig ? (
        <div className="mt-2">
          <Alert>That photo is over 10MB. Please choose a smaller one.</Alert>
        </div>
      ) : null}
      {state.error ? (
        <div className="mt-2">
          <Alert>{state.error}</Alert>
        </div>
      ) : null}
    </form>
  );
}
