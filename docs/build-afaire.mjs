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

// The page box is a fixed height and clips: check before trusting the render.
const fit = await page.evaluate(() => {
  const el = document.querySelector(".page");
  return { scroll: el.scrollHeight, client: el.clientHeight };
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
console.log(`pages: ${pageCount}  fit: ${fit.scroll}/${fit.client}  size: ${(bytes.length / 1024).toFixed(1)} KB`);
console.log(`written: ${out}`);

if (pageCount !== 1 || fit.scroll > fit.client) {
  console.error("CONTENT OVERFLOWS ONE PAGE — trim a-faire-v3.html");
  process.exit(1);
}
