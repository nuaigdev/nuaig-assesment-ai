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
};

export default nextConfig;
