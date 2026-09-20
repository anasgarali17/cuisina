/**
 * Renders docs/programme-valeur-client.html to an A4 PDF.
 * Run from the project root:  node docs/build-programme.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const html = path.resolve("docs/programme-valeur-client.html");
const out = path.resolve("docs/CUISINA-Programme-Valeur-Client.pdf");
const EXPECTED = 8;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(html).href, { waitUntil: "load" });

// Each .page is a fixed-height clipping box: measure the lowest element on
// each against its inner edge, since scrollHeight plateaus and hides the cut.
const over = await page.evaluate(() =>
  [...document.querySelectorAll(".page")].map((box, i) => {
    const r = box.getBoundingClientRect();
    const limit = r.bottom - parseFloat(getComputedStyle(box).paddingBottom);
    const last = [...box.querySelectorAll("table, p, ul, .card, .goal, .axe-row, footer")]
      .map((e) => e.getBoundingClientRect().bottom)
      .reduce((a, b) => Math.max(a, b), 0);
    return { page: i + 1, over: Math.round(last - limit) };
  }),
);

await page.pdf({
  path: out,
  format: "A4",
  printBackground: true,
  margin: { top: "0", right: "0", bottom: "0", left: "0" },
});
await browser.close();

const bytes = fs.readFileSync(out);
const pageCount = (bytes.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
const spills = over.filter((o) => o.over > 1);

console.log(`pages: ${pageCount}  size: ${(bytes.length / 1024).toFixed(1)} KB`);
console.log(`written: ${out}`);
if (spills.length) console.error("OVERFLOW:", JSON.stringify(spills));

if (pageCount !== EXPECTED || spills.length) {
  console.error(`EXPECTED ${EXPECTED} CLEAN PAGES — trim programme-valeur-client.html`);
  process.exit(1);
}
