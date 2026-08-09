/**
 * Renders docs/recap-client.html to a single-page A4 PDF.
 * Run from the project root:  node docs/build-pdf.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const html = path.resolve("docs/recap-client.html");
const out = path.resolve("docs/CUISINA-Recapitulatif-Phase1.pdf");

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(html).href, { waitUntil: "networkidle" });
await page.pdf({
  path: out,
  format: "A4",
  printBackground: true,
  margin: { top: "0", right: "0", bottom: "0", left: "0" },
});
await browser.close();

// The brief is one page — assert it rather than trusting the layout.
const bytes = fs.readFileSync(out);
const pageCount = (
  bytes.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []
).length;

console.log(`pages: ${pageCount}`);
console.log(`size: ${(bytes.length / 1024).toFixed(1)} KB`);
console.log(`written: ${out}`);
if (pageCount !== 1) {
  console.error("EXPECTED A SINGLE PAGE — trim recap-client.html");
  process.exit(1);
}
