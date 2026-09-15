#!/usr/bin/env node
// pnpm db:types — regenerates src/lib/supabase/database.types.ts from the hosted project's schema.
// App-facing aliases (AppUser, UserRole, ...) live in src/lib/supabase/types.ts, not here.
import { spawnSync } from "node:child_process";
import fs from "node:fs";

import { fail, loadEnv, run } from "./lib/supabase-api.mjs";

const OUTPUT = "src/lib/supabase/database.types.ts";

run(async () => {
  const { ref } = loadEnv();
  if (!/^[a-z0-9]{20}$/.test(ref)) fail("SUPABASE_PROJECT_REF doesn't look like a project ref.");
  // One command string (not args + shell) so npx resolves on Windows without DEP0190.
  const result = spawnSync(`npx supabase gen types typescript --project-id ${ref} --schema public`, {
    env: process.env,
    encoding: "utf8",
    shell: true,
  });
  if (result.status !== 0 || !result.stdout.includes("export type Database")) {
    fail(`supabase gen types failed:\n${result.stderr || result.stdout}`);
  }
  fs.writeFileSync(OUTPUT, result.stdout);
  console.log(`✓ Wrote ${OUTPUT}`);
});
