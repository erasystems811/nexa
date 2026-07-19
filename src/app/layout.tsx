import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { surfaceForHost } from "@/lib/surfaces";
import { BottomNav } from "@/components/bottom-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nexa - Event services marketplace",
  description:
    "Find verified vendors for your event - catering, DJs, photography, decor, venues and more. Contact them, compare, and book with your payment protected.",
  // The favicon comes from src/app/icon.png (+ apple-icon.png), sized from the
  // Nexa logo. Every surface — customer, vendor, admin — is this one app on a
  // subdomain, so they all inherit it. No manual icon link needed.
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0d0d0f",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const surface = surfaceForHost((await headers()).get("host"));

  return (
    <html lang="en">
      {/* Plain white. Content sits directly on the page — no card frame. */}
      <body className="min-h-dvh bg-white text-[color:var(--color-ink)]">
        {children}
        <BottomNav surface={surface} />
      </body>
    </html>
  );
}
