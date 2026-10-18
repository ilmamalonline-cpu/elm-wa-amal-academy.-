import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },
  // Note: the old `eslint: { ignoreDuringBuilds }` option (and `next lint`)
  // were removed in Next.js 16 — `next build` no longer runs ESLint at all.
  // Run `npm run lint` yourself / in CI.
};

export default nextConfig;
