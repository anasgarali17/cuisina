/**
 * Renders docs/a-faire-v3.html to a single-page A4 PDF.
 * Run from the project root:  node docs/build-afaire.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const html = path.resolve("docs/a-faire-v3.html");
const out = path.resolve("docs/CUISINA-A-faire-V3.pdf");

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(html).href, { waitUntil: "load" });

// The page box has a fixed height: measure the last item against its inner
// edge rather than scrollHeight, which plateaus and hides an overflow.
const fit = await page.evaluate(() => {
  const box = document.querySelector(".page");
  const r = box.getBoundingClientRect();
  const limit = r.bottom - parseFloat(getComputedStyle(box).paddingBottom);
  const last = [...box.querySelectorAll("li")]
    .map((e) => e.getBoundingClientRect().bottom)
    .reduce((a, b) => Math.max(a, b), 0);
  return { last: Math.round(last), limit: Math.round(limit) };
});

await page.pdf({
  path: out,
  format: "A4",
  printBackground: true,
  margin: { top: "0", right: "0", bottom: "0", left: "0" },
});
await browser.close();

const bytes = fs.readFileSync(out);
const pageCount = (bytes.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
console.log(`pages: ${pageCount}  content ends: ${fit.last}/${fit.limit}`);
console.log(`written: ${out}`);

if (pageCount !== 1 || fit.last > fit.limit) {
  console.error("CONTENT OVERFLOWS ONE PAGE — trim a-faire-v3.html");
  process.exit(1);
}
