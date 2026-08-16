import type { Metadata, Viewport } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import { headers } from "next/headers";
import { surfaceForHost } from "@/lib/surfaces";
import { getSession, signOut } from "@/modules/auth";
import { CustomerShell } from "@/components/customer-shell";
import "./globals.css";

// The display face (headline-level moments only) vs. the workhorse body/UI
// face — loaded as CSS variables and consumed via --app-font-serif/
// --app-font-sans in globals.css, matching the reference's own font split.
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-display-loaded",
  display: "swap",
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-body-loaded",
  display: "swap",
});

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
  themeColor: "#16211d",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const surface = surfaceForHost((await headers()).get("host"));
  // Only the customer surface's shell needs to know who's signed in (user
  // footer / sign-out) — Studio and Admin resolve their own session in their
  // own nested layouts.
  const session = surface === "customer" || surface === null ? await getSession() : null;
  // One Supabase Auth session backs every role today, so on a path-based dev
  // host (surface === null) a staff or provider login is technically "signed
  // in" everywhere. The customer header must never surface that — only ever
  // show account state for an actual customer identity.
  const customerUser =
    session && session.profile.role === "customer"
      ? { name: session.profile.full_name ?? session.email ?? "Account" }
      : null;

  return (
    <html lang="en" className={`${fraunces.variable} ${plusJakartaSans.variable}`}>
      <body className="min-h-dvh">
        <CustomerShell surface={surface} user={customerUser} signOutAction={signOut}>
          {children}
        </CustomerShell>
      </body>
    </html>
  );
}
