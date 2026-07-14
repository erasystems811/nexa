"use client";

import { useActionState } from "react";
import { setCategoryImageAction, type AdminActionState } from "@/modules/admin/actions";
import { Alert } from "@/components/ui";

const initialState: AdminActionState = {};

/**
 * One category, one photo. Choosing a file submits it — there is no second
 * button to press, because there is nothing else to decide.
 */
export function UploadPhoto({ slug, hasPhoto }: { slug: string; hasPhoto: boolean }) {
  const action = setCategoryImageAction.bind(null, slug);
  const [state, formAction, pending] = useActionState(action, initialState);

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
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
        />
      </label>

      {state.error ? (
        <div className="mt-2">
          <Alert>{state.error}</Alert>
        </div>
      ) : null}
    </form>
  );
}
