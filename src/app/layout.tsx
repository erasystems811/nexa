import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";

/**
 * Nexa's typeface.
 *
 * globals.css has always asked for `--font-sans` and nothing ever set it, so the
 * whole marketplace rendered in whatever the visitor's operating system happened
 * to default to — Segoe UI on Windows, Roboto on Android, San Francisco on an
 * iPhone. A brand that borrows the OS's font is a brand nobody remembers.
 *
 * DM Sans, one face for all of it. Geometric, low contrast, open counters — the
 * letterforms are calm rather than assertive, and calm is what premium actually
 * looks like on a screen. Two faces were tried and cut before it: a display serif
 * that was beautiful and unreadable on a phone, and a grotesk whose strokes were
 * simply too thick to feel expensive.
 *
 * Restraint is the brief. Weight is spent sparingly and size does the work — a
 * heavy headline reads as a discount banner, an airy one reads as a brand that
 * does not need to raise its voice.
 *
 * Loaded by Next, which means self-hosted and preloaded: no request to Google
 * from the visitor's browser, and no flash of the wrong font.
 *
 * Named for the face, not the role. `--font-sans` is a Tailwind theme token and
 * Tailwind emits its own default — the system stack — *after* next/font's
 * variables, at equal specificity. Naming this one `--font-sans` would have let
 * Tailwind quietly win, and the site would have gone on looking exactly as it
 * did. globals.css points the theme token at this instead.
 */
const sans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
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
    <html lang="en" className={sans.variable}>
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
