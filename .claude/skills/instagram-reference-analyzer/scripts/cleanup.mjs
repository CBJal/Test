#!/usr/bin/env node
// Removes a temporary media directory created by extract.mjs.
//
// Usage: node cleanup.mjs <dir>
//
// Refuses to delete anything that isn't clearly a scratch directory (must
// contain "instagram_reference" in its path) so a typo in --out-dir can
// never turn this into an accidental rm -rf of something real.

import { rm } from "node:fs/promises";

const dir = process.argv[2];

if (!dir) {
  console.error("Usage: node cleanup.mjs <dir>");
  process.exit(1);
}

if (!dir.includes("instagram_reference")) {
  console.error(
    `Refusing to delete "${dir}": path does not contain "instagram_reference", ` +
      "so it doesn't look like a directory this skill created."
  );
  process.exit(1);
}

try {
  await rm(dir, { recursive: true, force: true });
  console.log(`Removed ${dir}`);
} catch (err) {
  console.error(`Failed to remove ${dir}: ${err.message}`);
  process.exit(1);
}
