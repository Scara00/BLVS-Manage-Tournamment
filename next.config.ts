import type { NextConfig } from "next";
import { HSTS_HEADER_VALUE, isHttpsEnforced } from "./src/lib/security/https";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // forbidden() → app/forbidden.tsx with HTTP 403.
    cpus: 6,
    authInterrupts: true,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    // HSTS only where HTTPS is enforced (staging/production): on http://localhost
    // it would be ignored at best and pin the host to HTTPS at worst.
    const hsts = isHttpsEnforced()
      ? [{ key: "Strict-Transport-Security", value: HSTS_HEADER_VALUE }]
      : [];
    return [
      {
        source: "/:path*",
        headers: [
          ...hsts,
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
