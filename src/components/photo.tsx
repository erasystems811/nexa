"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * The one image component the whole app uses for real photos.
 *
 * The "pasted on a screen" feeling customers were hitting has two causes, and
 * both are fixed here rather than per-page:
 *
 *   1. No reserved space. A raw <img> has no known size until it has finished
 *      downloading, so it pops into existence and shoves everything below it —
 *      that shove IS the "feels pasted" moment. next/image always renders into
 *      a box of a known size, so nothing around it ever moves.
 *   2. Hard pop-in. Even with space reserved, an image that goes from nothing to
 *      fully-there in one frame reads as a glitch. This fades it in over 200ms
 *      instead, which is the same trick Netflix/Spotify posters use — you see
 *      it arrive, not snap in.
 *
 * next/image also means the browser only ever downloads a version sized for
 * where it's actually displayed (a 96px avatar never pulls a 4000px original),
 * which is most of "no delay, no wait" on a slow connection.
 */
export function Photo({
  src,
  alt,
  fill,
  width,
  height,
  sizes,
  className,
  imageClassName,
  priority,
}: {
  src: string | null | undefined;
  alt: string;
  fill?: boolean;
  width?: number;
  height?: number;
  sizes?: string;
  /** In `fill` mode: the wrapper's sizing/shape (aspect ratio, rounding). */
  className?: string;
  /** In `fill` mode only: extra classes on the <img> itself — e.g. a hover scale. */
  imageClassName?: string;
  priority?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);

  if (!src) {
    return (
      <div
        className={`bg-[color:var(--color-surface-sunk)] ${className ?? ""}`}
        style={!fill ? { width, height } : undefined}
      />
    );
  }

  const fadeClass = `transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"}`;

  if (fill) {
    return (
      <div className={`relative overflow-hidden bg-[color:var(--color-surface-sunk)] ${className ?? ""}`}>
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes={sizes ?? "100vw"}
          onLoad={() => setLoaded(true)}
          className={`object-cover ${fadeClass} ${imageClassName ?? ""}`}
        />
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width ?? 0}
      height={height ?? 0}
      sizes={sizes}
      priority={priority}
      onLoad={() => setLoaded(true)}
      className={`${className ?? ""} ${fadeClass}`}
    />
  );
}
