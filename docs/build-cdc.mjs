/**
 * Renders docs/cahier-des-charges-v3.html to an A4 PDF.
 * Run from the project root:  node docs/build-cdc.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const html = path.resolve("docs/cahier-des-charges-v3.html");
const out = path.resolve("docs/CUISINA-Cahier-des-charges-V3.pdf");

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(html).href, { waitUntil: "load" });
await page.pdf({
  path: out,
  format: "A4",
  printBackground: true,
  margin: { top: "0", right: "0", bottom: "0", left: "0" },
});
await browser.close();

const bytes = fs.readFileSync(out);
const pageCount = (
  bytes.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []
).length;

console.log(`pages: ${pageCount}`);
console.log(`size: ${(bytes.length / 1024).toFixed(1)} KB`);
console.log(`written: ${out}`);

// Five sections, five pages — a fourth means a section overflowed.
if (pageCount !== 5) {
  console.error(`EXPECTED 5 PAGES, GOT ${pageCount} — trim cahier-des-charges-v3.html`);
  process.exit(1);
}
