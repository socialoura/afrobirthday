#!/usr/bin/env node
/**
 * Every URL the indexation probe reports to Search Console has to answer 200.
 *
 * Reporting an address that redirects wastes the inspection: crawlers do not
 * follow redirects for indexing, so the verdict describes a URL nobody will
 * ever index. This is the check that catches the mistake before a whole
 * nightly pass is thrown away.
 *
 * Run with: npm run check:seo-urls
 */
import { allIndexableUrls } from "../src/lib/seoUrls.ts";

const urls = allIndexableUrls();
console.log(`${urls.length} URL declarees\n`);

let ok = 0;
const bad = [];

for (const url of urls) {
  try {
    const res = await fetch(url, { redirect: "manual" });
    if (res.status === 200) {
      ok++;
    } else {
      bad.push(`${res.status}  ${url}${res.headers.get("location") ? "  ->  " + res.headers.get("location") : ""}`);
    }
  } catch (err) {
    bad.push(`ERR  ${url}  ${String(err).slice(0, 60)}`);
  }
}

console.log(`${ok}/${urls.length} repondent 200`);
if (bad.length) {
  console.log("\nURL QUI NE REPONDENT PAS 200 — elles ne seront jamais indexees telles quelles");
  for (const b of bad) console.log("  " + b);
}
process.exit(bad.length ? 1 : 0);
