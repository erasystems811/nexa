import { useState } from "react";
import { apiUpload } from "../lib/api";

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * One category, one photo. Choosing a file uploads it — there is no second
 * button to press, because there is nothing else to decide.
 *
 * The size is checked here, before anything is sent, so an over-size file
 * gets a plain message instead of a failed request.
 */
export function UploadPhoto({
  slug,
  hasPhoto,
  onUploaded,
}: {
  slug: string;
  hasPhoto: boolean;
  onUploaded: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tooBig, setTooBig] = useState(false);

  async function handleFile(file: File) {
    if (file.size > MAX_BYTES) {
      setTooBig(true);
      return;
    }
    setTooBig(false);
    setError(null);
    setPending(true);
    try {
      await apiUpload(`/admin/categories/${slug}/image`, file);
      onUploaded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not upload that photo");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-3">
      <label className="block cursor-pointer">
        <span className="inline-flex h-9 items-center rounded-md border px-3 text-xs font-medium hover:bg-muted">
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
            e.currentTarget.value = "";
            if (file) void handleFile(file);
          }}
        />
      </label>

      {tooBig ? <p className="mt-2 text-xs text-destructive">That photo is over 10MB. Please choose a smaller one.</p> : null}
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
