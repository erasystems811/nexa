import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nexa — Event supply marketplace",
  description:
    "Open one app. Close it knowing your event is under control. Book verified providers and pay safely.",
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
      <body className="min-h-dvh bg-white text-[color:var(--color-ink)]">
        {children}
      </body>
    </html>
  );
}
