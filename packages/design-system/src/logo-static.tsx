import clsx from "clsx";

// Plain <img> variant for the Vite SPAs (Studio, Admin) — logo.tsx uses
// next/image, which only exists in the Next.js customer app. Both apps must
// serve /nexa-logo.png from their own public/ directory.
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
      <img
        src="/nexa-logo.png"
        alt=""
        width={64}
        height={64}
        className={clsx("size-9 rounded-2xl object-cover shadow-sm", markClassName)}
      />
      <span className={clsx("font-semibold tracking-tight", textClassName)}>{label}</span>
    </span>
  );
}
