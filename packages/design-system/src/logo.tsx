// Uses next/image, so this component works as-is for the customer app (Next.js).
// Studio and Admin will be Vite SPAs (see the monorepo split plan) — when those
// are built, this needs a plain <img>-based variant, or a build-time swap.
import Image from "next/image";
import clsx from "clsx";

type LogoProps = {
  label?: string;
  className?: string;
  markClassName?: string;
  textClassName?: string;
};

export function Logo({
  label = "Nexa",
  className,
  markClassName,
  textClassName,
}: LogoProps) {
  return (
    <span className={clsx("inline-flex items-center gap-2", className)}>
      <Image
        src="/nexa-logo.png"
        alt=""
        width={64}
        height={64}
        className={clsx("size-9 rounded-2xl object-cover shadow-sm", markClassName)}
        priority
      />
      <span className={clsx("font-semibold tracking-tight", textClassName)}>{label}</span>
    </span>
  );
}
