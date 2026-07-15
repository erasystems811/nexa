import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  outputFileTracingRoot: path.join(__dirname),
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
