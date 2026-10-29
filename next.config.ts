import type { NextConfig } from "next";
import { HSTS_HEADER_VALUE, isHttpsEnforced } from "./src/lib/security/https";

/**
 * No script/style restrictions (Next inlines its own scripts): this CSP only
 * blocks framing, plugins, foreign <base> and forms posting elsewhere.
 */
const CONTENT_SECURITY_POLICY = [
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  cacheComponents: true,
  poweredByHeader: false,
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
          { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
