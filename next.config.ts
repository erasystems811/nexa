import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  outputFileTracingRoot: path.join(__dirname),
  images: {
    // Every photo in Nexa — listings, vendor logos/covers, category tiles —
    // lives in Supabase Storage. Without this, next/image refuses the URL and
    // every image on the site is back to a raw, unoptimized <img>.
    remotePatterns: [
      {
        // Public bucket photos (categories, provider profile) and signed URLs
        // (private provider-media — listing photos, re-signed server-side) use
        // different path prefixes; both need to be allowed.
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/**",
      },
    ],
  },
  experimental: {
    // Server Actions cap the request body at 1MB by default, and every upload in
    // Nexa is a Server Action: category photos, listing media, a vendor's ID.
    // The code already limits these to 10MB itself — but that check never ran,
    // because Next rejected anything past 1MB first and the whole page crashed.
    // A phone photo is 2–8MB, so "some images crash" was really "any real photo".
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
