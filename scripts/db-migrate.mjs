#!/usr/bin/env node
// pnpm db:migrate [--dry-run] — applies pending supabase/migrations/*.sql to the hosted project.
// All pending migrations are first run together in a rolled-back transaction; nothing is
// applied unless that dry run succeeds. Applied migrations are tracked by file name.
import fs from "node:fs";
import path from "node:path";

import { loadEnv, managementApi, run, runRolledBack } from "./lib/supabase-api.mjs";

const MIGRATIONS_DIR = "supabase/migrations";

run(async () => {
  const api = managementApi(loadEnv());
  const dryRunOnly = process.argv.includes("--dry-run");

  const local = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => ({
      name: file.replace(/\.sql$/, ""),
      sql: fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"),
    }));

  const applied = new Set((await api.call("/database/migrations")).map((m) => m.name));
  const pending = local.filter((m) => !applied.has(m.name));

  if (pending.length === 0) {
    console.log("• Database is up to date");
    return;
  }
  console.log(`Pending: ${pending.map((m) => m.name).join(", ")}`);

  await runRolledBack(api, pending.map((m) => m.sql).join("\n\n"));
  console.log("✓ Dry run passed (rolled back)");
  if (dryRunOnly) return;

  for (const migration of pending) {
    await api.call("/database/migrations", {
      method: "POST",
      body: { name: migration.name, query: migration.sql },
    });
    console.log(`✓ Applied ${migration.name}`);
  }
});
