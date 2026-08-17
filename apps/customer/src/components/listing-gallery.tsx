"use client";

import { useState } from "react";
import { Photo } from "@/components/photo";
import { cn } from "@/lib/utils";

/** All of a listing's approved photos - a big main image, thumbnails to switch. */
export function ListingGallery({ photos, alt }: { photos: string[]; alt: string }) {
  const [active, setActive] = useState(0);

  if (photos.length === 0) {
    return <Photo src={null} alt={alt} fill className="aspect-[16/9] rounded-2xl" />;
  }

  return (
    <div>
      <Photo
        src={photos[active]}
        alt={alt}
        fill
        priority
        sizes="(max-width: 640px) 100vw, 672px"
        className="aspect-[16/9] rounded-2xl"
      />
      {photos.length > 1 ? (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {photos.map((photo, i) => (
            <button
              key={photo}
              type="button"
              onClick={() => setActive(i)}
              className={cn(
                "relative size-16 shrink-0 overflow-hidden rounded-lg border-2 transition",
                i === active ? "border-primary" : "border-transparent opacity-70 hover:opacity-100",
              )}
            >
              <Photo src={photo} alt="" fill sizes="64px" className="h-full w-full" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
