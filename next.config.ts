import type { NextConfig } from "next";

import { parseEnv, serverEnvSchema } from "./src/lib/env/schema";

// Fail `next build` and `next dev` on missing or malformed configuration (spec §15).
// `next typegen` loads this file too but needs no secrets, so type-checking works without an .env.
if (!process.argv.includes("typegen")) {
  parseEnv(serverEnvSchema, process.env);
}

const nextConfig: NextConfig = {
  experimental: {
    // Enables forbidden() for admin-only routes.
    authInterrupts: true,
  },
  async headers() {
    return [
      {
        // Magic-link tokens live in these URLs: never leak them via Referer, never index them.
        source: "/join/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
