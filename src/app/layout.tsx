import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Instrument_Serif } from "next/font/google";
import "./globals.css";

/**
 * Nexa's typeface.
 *
 * globals.css has always asked for `--font-sans` and nothing ever set it, so the
 * whole marketplace rendered in whatever the visitor's operating system happened
 * to default to — Segoe UI on Windows, Roboto on Android, San Francisco on an
 * iPhone. A brand that borrows the OS's font is a brand nobody remembers.
 *
 * Instrument Sans carries the interface: a grotesk with slightly narrow, modern
 * letterforms that hold up small, which is where a marketplace lives — prices,
 * vendor names, status pills.
 *
 * Instrument Serif carries the few big lines that have to make somebody feel
 * something: the homepage promise, a section that is selling rather than
 * informing. Events are weddings and birthdays and funerals; a serif says
 * "occasion" in a way no grotesk can, and using it sparingly is what keeps it
 * feeling expensive rather than decorative.
 *
 * Both are loaded by Next, which means self-hosted and preloaded — no request to
 * Google from the visitor's browser, and no flash of the wrong font.
 */
/*
 * Named for the face, not the role — `--font-sans` and `--font-display` are
 * Tailwind theme tokens, and Tailwind emits its own defaults for them *after*
 * next/font's variables in the stylesheet. Same specificity, later wins: naming
 * these `--font-sans` would have let Tailwind's system-font stack quietly beat
 * Instrument Sans, and the site would have gone on looking exactly as it did.
 * globals.css maps the theme tokens onto these instead.
 */
const sans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument-sans",
  display: "swap",
});

const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-instrument-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nexa - Event services marketplace",
  description:
    "Find verified vendors for your event - catering, DJs, photography, decor, venues and more. Contact them, compare, and book with your payment protected.",
  icons: {
    icon: "/nexa-logo.png",
    apple: "/nexa-logo.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0d0d0f",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      {/*
        The marketplace sits on the sunk grey, not on the page. Every customer
        screen is a white card floating on it — which is what stops Nexa reading
        as words typed onto paper. Admin and Studio each paint their own
        full-height background over this, so they are untouched.
      */}
      <body className="min-h-dvh bg-[color:var(--color-surface-sunk)] text-[color:var(--color-ink)]">
        {children}
      </body>
    </html>
  );
}
