/**
 * Batch 2B Part 3 captures: FAQ, next steps, footer.
 * node capture-batch-2b-part3.mjs --base=http://localhost:3000 --prefix=batch-2b-part3-after
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
const PREFIX = argPrefix ?? "batch-2b-part3-after";

const SHOTS = [
  { name: `${PREFIX}-en-faq-1440`, path: "/", anchor: "#faq", width: 1440, height: 900 },
  { name: `${PREFIX}-en-faq-375`, path: "/", anchor: "#faq", width: 375, height: 812 },
  { name: `${PREFIX}-en-next-steps-1440`, path: "/", anchor: "#next-steps", width: 1440, height: 900 },
  { name: `${PREFIX}-en-next-steps-375`, path: "/", anchor: "#next-steps", width: 375, height: 812 },
  { name: `${PREFIX}-en-footer-1440`, path: "/", anchor: "footer", width: 1440, height: 900 },
  { name: `${PREFIX}-en-footer-375`, path: "/", anchor: "footer", width: 375, height: 812 },
  { name: `${PREFIX}-en-about-1440`, path: "/about", anchor: "main", width: 1440, height: 900 },
  { name: `${PREFIX}-si-faq-page-1440`, path: "/si/faq", anchor: "#faq", width: 1440, height: 900 },
];

async function captureSection(page, url, anchor, outFile) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  if (anchor === "footer") {
    await page.evaluate(() => document.querySelector("footer")?.scrollIntoView({ block: "end" }));
  } else if (anchor === "main") {
    await page.evaluate(() => document.querySelector("main")?.scrollIntoView({ block: "start" }));
  } else {
    await page.evaluate((hash) => {
      document.querySelector(hash)?.scrollIntoView({ block: "start" });
    }, anchor);
  }
  await page.waitForTimeout(400);
  const locator =
    anchor === "footer"
      ? page.locator("footer")
      : anchor === "main"
        ? page.locator("main")
        : page.locator(anchor);
  await locator.waitFor({ state: "visible", timeout: 15_000 });
  await locator.screenshot({ path: outFile });
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
