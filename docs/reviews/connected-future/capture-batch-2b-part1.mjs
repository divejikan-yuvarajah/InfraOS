/**
 * One-off Playwright captures for Batch 2B Part 1 review.
 * Usage (from repo root): node docs/reviews/connected-future/capture-batch-2b-part1.mjs
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "screenshots");
const argBase = process.argv.find((a) => a.startsWith("--base="))?.slice(7);
const argPrefix = process.argv.find((a) => a.startsWith("--prefix="))?.slice(9);
const BASE = argBase ?? process.env.INFRAOS_CAPTURE_BASE ?? "http://localhost:3000";
const PREFIX = argPrefix ?? process.env.INFRAOS_CAPTURE_PREFIX ?? "batch-2b-after";

const SHOTS = [
  { name: `${PREFIX}-en-problem-1440`, path: "/", anchor: "#problem", width: 1440, height: 900 },
  { name: `${PREFIX}-en-problem-375`, path: "/", anchor: "#problem", width: 375, height: 812 },
  { name: `${PREFIX}-en-features-1440`, path: "/", anchor: "#features", width: 1440, height: 900 },
  { name: `${PREFIX}-en-features-375`, path: "/", anchor: "#features", width: 375, height: 812 },
  { name: `${PREFIX}-en-lifecycle-1440`, path: "/", anchor: "#how-it-works", width: 1440, height: 900 },
  { name: `${PREFIX}-en-lifecycle-375`, path: "/", anchor: "#how-it-works", width: 375, height: 812 },
  { name: `${PREFIX}-si-problem-1440`, path: "/si", anchor: "#problem", width: 1440, height: 900 },
  { name: `${PREFIX}-si-features-1440`, path: "/si", anchor: "#features", width: 1440, height: 900 },
  { name: `${PREFIX}-ta-lifecycle-1440`, path: "/ta", anchor: "#how-it-works", width: 1440, height: 900 },
  { name: `${PREFIX}-ta-features-1440`, path: "/ta", anchor: "#features", width: 1440, height: 900 },
];

async function captureSection(page, url, anchor, outFile) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.evaluate((hash) => {
    const el = document.querySelector(hash);
    if (el) el.scrollIntoView({ block: "start" });
  }, anchor);
  await page.waitForTimeout(400);
  const section = page.locator(anchor);
  await section.waitFor({ state: "visible", timeout: 15_000 });
  await section.screenshot({ path: outFile });
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  for (const shot of SHOTS) {
    const context = await browser.newContext({
      viewport: { width: shot.width, height: shot.height },
      deviceScaleFactor: shot.width <= 400 ? 2 : 1,
    });
    const page = await context.newPage();
    const url = `${BASE}${shot.path}`;
    const outFile = path.join(OUT, `${shot.name}.png`);
    console.log("Capturing", outFile);
    await captureSection(page, url, shot.anchor, outFile);
    await context.close();
  }
  await browser.close();
  console.log("Done.", OUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
