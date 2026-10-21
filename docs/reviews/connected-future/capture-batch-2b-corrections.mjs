/**
 * Post-correction captures: GIS mobile, lifecycle, FAQ, footer.
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "screenshots");
const BASE = process.argv.find((a) => a.startsWith("--base="))?.slice(7) ?? "http://localhost:3000";

const SHOTS = [
  { name: "batch-2b-corrected-en-preview-320", path: "/", anchor: "#preview", width: 320, height: 568 },
  { name: "batch-2b-corrected-en-preview-375", path: "/", anchor: "#preview", width: 375, height: 812 },
  { name: "batch-2b-corrected-en-preview-768", path: "/", anchor: "#preview", width: 768, height: 1024 },
  { name: "batch-2b-corrected-en-preview-1024", path: "/", anchor: "#preview", width: 1024, height: 768 },
  { name: "batch-2b-corrected-en-preview-1440", path: "/", anchor: "#preview", width: 1440, height: 900 },
  { name: "batch-2b-corrected-en-preview-1920", path: "/", anchor: "#preview", width: 1920, height: 1080 },
  { name: "batch-2b-corrected-en-lifecycle-375", path: "/", anchor: "#how-it-works", width: 375, height: 812 },
  { name: "batch-2b-corrected-en-lifecycle-768", path: "/", anchor: "#how-it-works", width: 768, height: 1024 },
  { name: "batch-2b-corrected-en-lifecycle-1024", path: "/", anchor: "#how-it-works", width: 1024, height: 768 },
  { name: "batch-2b-corrected-en-faq-375", path: "/", anchor: "#faq", width: 375, height: 812 },
  { name: "batch-2b-corrected-en-faq-768", path: "/", anchor: "#faq", width: 768, height: 1024 },
  { name: "batch-2b-corrected-en-footer-375", path: "/", anchor: "footer", width: 375, height: 812 },
  { name: "batch-2b-corrected-en-footer-1024", path: "/", anchor: "footer", width: 1024, height: 768 },
  { name: "batch-2b-corrected-si-preview-375", path: "/si", anchor: "#preview", width: 375, height: 812 },
  { name: "batch-2b-corrected-ta-faq-375", path: "/ta", anchor: "#faq", width: 375, height: 812 },
];

async function capture(page, url, anchor, outFile) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  if (anchor === "footer") {
    await page.evaluate(() => document.querySelector("footer")?.scrollIntoView({ block: "end" }));
  } else {
    await page.evaluate((h) => document.querySelector(h)?.scrollIntoView({ block: "start" }), anchor);
  }
  await page.waitForTimeout(450);
  const loc =
    anchor === "footer" ? page.locator("footer") : page.locator(anchor);
  await loc.screenshot({ path: outFile });
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  for (const s of SHOTS) {
    const ctx = await browser.newContext({
      viewport: { width: s.width, height: s.height },
      deviceScaleFactor: s.width <= 400 ? 2 : 1,
    });
    const page = await ctx.newPage();
    const out = path.join(OUT, `${s.name}.png`);
    console.log(out);
    await capture(page, `${BASE}${s.path}`, s.anchor, out);
    await ctx.close();
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
