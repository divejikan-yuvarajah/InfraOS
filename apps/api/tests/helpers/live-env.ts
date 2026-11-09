import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Opt-in (AI_LIVE=1): loads apps/api/.env into the test process BEFORE the app modules read their configuration. Must be the first import of a live test. */
if (process.env.AI_LIVE) {
  try {
    for (const line of readFileSync(resolve(process.cwd(), ".env"), "utf8").split(/\r?\n/)) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
      if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2]!.trim();
    }
  } catch { /* no local env file */ }
  process.env.AI_PROCESSING_ENABLED = "true";
}
