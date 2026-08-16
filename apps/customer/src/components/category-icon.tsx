import clsx from "clsx";

/**
 * The category icons.
 *
 * Emoji were doing this job, and emoji are the fastest way to make a marketplace
 * look like a side project: they render as a different picture on every device,
 * they carry someone else's colour palette into a page built on one accent, and
 * they read as chat, not commerce. These are one line weight, one grid, no fill,
 * and they take the colour of whatever they sit in — so they belong to Nexa
 * rather than to Apple or Google.
 *
 * Keyed by category slug. A category Admin adds later, with no icon here, gets
 * the mark below rather than a hole.
 */

const ICONS: Record<string, React.ReactNode> = {
  catering: (
    <>
      <path d="M3.5 16.5h17" />
      <path d="M5.5 16.5a6.5 6.5 0 0 1 13 0" />
      <path d="M12 10V7.5" />
    </>
  ),
  cakes: (
    <>
      <path d="M4 20.5h16" />
      <path d="M5.5 20.5v-5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v5" />
      <path d="M12 13.5V10" />
      <circle cx="12" cy="7.5" r="1.2" />
    </>
  ),
  "djs-mcs": (
    <>
      <path d="M5 15v-2.5a7 7 0 0 1 14 0V15" />
      <path d="M5 14.5h2a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H5z" />
      <path d="M19 14.5h-2a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h2z" />
    </>
  ),
  "live-performers": (
    <>
      <rect x="9.5" y="3" width="5" height="9" rx="2.5" />
      <path d="M6.5 11a5.5 5.5 0 0 0 11 0" />
      <path d="M12 16.5V20.5" />
      <path d="M9 20.5h6" />
    </>
  ),
  photography: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8.5 7l1.5-2.5h4L15.5 7" />
      <circle cx="12" cy="13.5" r="3.5" />
    </>
  ),
  videography: (
    <>
      <rect x="3" y="7" width="12" height="10" rx="2" />
      <path d="M15 10.5l6-2.5v8l-6-2.5z" />
    </>
  ),
  "car-rental": (
    <>
      <path d="M4.5 14h15" />
      <path d="M6 14l1.4-4.1A2 2 0 0 1 9.3 8.6h5.4a2 2 0 0 1 1.9 1.3L18 14" />
      <circle cx="8.5" cy="15.2" r="1.5" />
      <circle cx="15.5" cy="15.2" r="1.5" />
    </>
  ),
  decor: (
    <>
      <path d="M4 20.5v-4.5a8 8 0 0 1 16 0v4.5" />
      <path d="M3 20.5h4" />
      <path d="M17 20.5h4" />
      <path d="M12 8v4" />
    </>
  ),
  "sound-lighting": (
    <>
      <rect x="6" y="3" width="12" height="18" rx="2" />
      <circle cx="12" cy="14.5" r="3.5" />
      <circle cx="12" cy="7" r="1.2" />
    </>
  ),
  rentals: (
    <>
      <path d="M8 12V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v7" />
      <path d="M5.5 12h13" />
      <path d="M7.5 12l-1 8.5" />
      <path d="M16.5 12l1 8.5" />
    </>
  ),
  "makeup-styling": (
    <>
      <rect x="9" y="10" width="6" height="10.5" rx="1" />
      <path d="M10 10V6.5a2 2 0 0 1 4 0V10" />
    </>
  ),
  venues: (
    <>
      <path d="M3 20.5h18" />
      <path d="M3.5 9.5L12 4l8.5 5.5" />
      <path d="M5.5 20.5V10" />
      <path d="M9.8 20.5V10" />
      <path d="M14.2 20.5V10" />
      <path d="M18.5 20.5V10" />
    </>
  ),
  "event-staff": (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5.5 20.5a6.5 6.5 0 0 1 13 0" />
    </>
  ),
  security: <path d="M12 3.5l7 2.8v5c0 4.2-2.9 7.4-7 8.4-4.1-1-7-4.2-7-8.4v-5z" />,
  cleaning: (
    <>
      <path d="M11 3.5l1.7 4.4 4.4 1.7-4.4 1.7L11 15.7 9.3 11.3 4.9 9.6l4.4-1.7z" />
      <path d="M17.5 14.5l.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9z" />
    </>
  ),
  "transport-logistics": (
    <>
      <path d="M3 16.5V8.5a1 1 0 0 1 1-1h9v9" />
      <path d="M13 10.5h4l4 4v2h-3" />
      <circle cx="7" cy="17.5" r="2" />
      <circle cx="17" cy="17.5" r="2" />
      <path d="M9 17.5h6" />
    </>
  ),
  "event-planning": (
    <>
      <path d="M9 3.5h6a1 1 0 0 1 1 1V6H8V4.5a1 1 0 0 1 1-1z" />
      <path d="M8 6H6.5A1.5 1.5 0 0 0 5 7.5v12A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-12A1.5 1.5 0 0 0 17.5 6H16" />
      <path d="M8.8 11.5l1.4 1.4 2.8-2.8" />
      <path d="M14.5 16.5H9" />
    </>
  ),
};

/** A category with no icon of its own still gets a mark, never a gap. */
const FALLBACK = (
  <path d="M12 3.5l2.3 6.2 6.2 2.3-6.2 2.3L12 20.5l-2.3-6.2L3.5 12l6.2-2.3z" />
);

export function CategoryIcon({
  slug,
  className,
}: {
  slug: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={clsx("size-6", className)}
    >
      {ICONS[slug] ?? FALLBACK}
    </svg>
  );
}
