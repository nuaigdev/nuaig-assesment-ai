#!/usr/bin/env node
// pnpm db:test [file...] — runs pgTAP tests (supabase/tests/database/*.test.sql) against the
// hosted project inside a transaction that is always rolled back: fixtures, pgTAP itself and
// every write disappear afterwards.
//
// Test files are written like `supabase test db` files (begin; select plan(n); ... finish(); rollback;).
// Top-level statements starting with `select` at column 0 have their output captured.
import fs from "node:fs";
import path from "node:path";

import { loadEnv, managementApi, run, runRolledBack } from "./lib/supabase-api.mjs";

const TESTS_DIR = "supabase/tests/database";

function toCapturingSql(source) {
  const body = source
    .replace(/^\s*begin;\s*$/m, "")
    .replace(/^\s*rollback;\s*$/m, "")
    .replace(/^select /gm, "insert into pg_temp._tap (line) select ");
  return [
    "create extension if not exists pgtap with schema extensions;",
    "set local search_path = public, extensions;",
    "create temp table _tap (line text);",
    "grant insert, select on pg_temp._tap to public;",
    body,
    "reset role;",
  ].join("\n");
}

run(async () => {
  const api = managementApi(loadEnv());
  const requested = process.argv.slice(2);
  const files = requested.length
    ? requested
    : fs
        .readdirSync(TESTS_DIR)
        .filter((file) => file.endsWith(".test.sql"))
        .sort()
        .map((file) => path.join(TESTS_DIR, file));

  let failures = 0;
  for (const file of files) {
    console.log(`\n# ${file}`);
    const output = await runRolledBack(
      api,
      toCapturingSql(fs.readFileSync(file, "utf8")),
      "(select string_agg(line, E'\\n' order by ctid) from pg_temp._tap)",
    );
    const lines = output.split("\n");
    for (const line of lines) console.log(line);
    failures += lines.filter((line) => line.startsWith("not ok") || /Looks like/.test(line)).length;
  }

  if (failures > 0) {
    console.error(`\n✗ ${failures} problem(s)`);
    process.exit(1);
  }
  console.log("\n✓ All database tests passed (rolled back)");
});
