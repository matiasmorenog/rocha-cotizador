#!/usr/bin/env node
/**
 * Print DATABASE_URL from a Vercel env pull file (e.g. .vercel/.env.production.local).
 * Usage: node scripts/read-vercel-database-url.js .vercel/.env.production.local
 */
const fs = require("fs");

const file = process.argv[2];
if (!file) {
  console.error("usage: node scripts/read-vercel-database-url.js <env-file>");
  process.exit(1);
}

const raw = fs.readFileSync(file, "utf8");
const m = raw.match(/^DATABASE_URL=(.*)$/m);
if (!m) {
  console.error(`DATABASE_URL not found in ${file}`);
  process.exit(1);
}

let v = m[1].trim();
if (
  (v.startsWith('"') && v.endsWith('"')) ||
  (v.startsWith("'") && v.endsWith("'"))
) {
  v = v.slice(1, -1);
}

if (!v) {
  console.error("DATABASE_URL is empty");
  process.exit(1);
}

process.stdout.write(v);
