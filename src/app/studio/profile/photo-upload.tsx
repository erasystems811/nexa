"use client";

import { useRef, useState } from "react";
import { uploadProfilePhotoAction } from "@/modules/provider/actions";

/**
 * Logo (square) or cover (wide) upload. This is what closes the gap where a
 * vendor with listings had no profile photo of their own — the vendor page
 * rendered an empty box because nothing ever let them set one.
 */
export function PhotoUpload({
  kind,
  label,
  aspect,
  initialUrl,
}: {
  kind: "logo" | "cover";
  label: string;
  aspect: "square" | "wide";
  initialUrl: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(initialUrl);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onPick = async (file: File) => {
    setPending(true);
    setError(null);
    // Optimistic local preview — the upload can take a second on a slow
    // connection, and staring at a blank box while it happens is exactly the
    // kind of dead moment this pass is meant to remove.
    const localPreview = URL.createObjectURL(file);
    setUrl(localPreview);

    const result = await uploadProfilePhotoAction(kind, file);
    setPending(false);
    if (result.error) {
      setError(result.error);
      setUrl(initialUrl);
      return;
    }
    setUrl(result.url ?? localPreview);
  };

  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={`group relative block w-full overflow-hidden rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-surface-sunk)] transition ${
          aspect === "square" ? "aspect-square max-w-[160px]" : "aspect-[3/1]"
        }`}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- user-uploaded, arbitrary origin
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-xs text-[color:var(--color-ink-muted)]">
            Add a photo
          </span>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-sm font-medium text-white opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100">
          {pending ? "Uploading…" : "Change"}
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onPick(file);
          e.target.value = "";
        }}
      />
      {error ? <p className="mt-1 text-xs text-[color:var(--color-danger)]">{error}</p> : null}
    </div>
  );
}
