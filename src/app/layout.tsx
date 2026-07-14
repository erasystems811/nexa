import type { Metadata, Viewport } from "next";
import "./globals.css";

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
    <html lang="en">
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
