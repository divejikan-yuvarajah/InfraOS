/**
 * Batch 2B Part 2 section captures.
 * node capture-batch-2b-part2.mjs --base=http://localhost:3000 --prefix=batch-2b-part2-after
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "screenshots");
const argBase = process.argv.find((a) => a.startsWith("--base="))?.slice(7);
const argPrefix = process.argv.find((a) => a.startsWith("--prefix="))?.slice(9);
const BASE = argBase ?? "http://localhost:3000";
const PREFIX = argPrefix ?? "batch-2b-part2-after";

const SHOTS = [
  { name: `${PREFIX}-en-preview-1440`, path: "/", anchor: "#preview", width: 1440, height: 900 },
  { name: `${PREFIX}-en-preview-375`, path: "/", anchor: "#preview", width: 375, height: 812 },
  { name: `${PREFIX}-en-audiences-1440`, path: "/", anchor: "#audiences", width: 1440, height: 900 },
  { name: `${PREFIX}-en-audiences-375`, path: "/", anchor: "#audiences", width: 375, height: 812 },
  { name: `${PREFIX}-en-trust-1440`, path: "/", anchor: "#trust-information", width: 1440, height: 900 },
  { name: `${PREFIX}-en-trust-375`, path: "/", anchor: "#trust-information", width: 375, height: 812 },
  { name: `${PREFIX}-en-transparency-1440`, path: "/", anchor: "#transparency", width: 1440, height: 900 },
  { name: `${PREFIX}-en-transparency-375`, path: "/", anchor: "#transparency", width: 375, height: 812 },
  { name: `${PREFIX}-si-preview-1440`, path: "/si", anchor: "#preview", width: 1440, height: 900 },
  { name: `${PREFIX}-ta-audiences-1440`, path: "/ta", anchor: "#audiences", width: 1440, height: 900 },
];

async function captureSection(page, url, anchor, outFile) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.evaluate((hash) => {
    document.querySelector(hash)?.scrollIntoView({ block: "start" });
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
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
