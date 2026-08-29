#!/usr/bin/env node
/**
 * Reproducible page-speed measurement, driving the installed Chrome on a
 * throttled mobile profile.
 *
 * These are not field data. They are the same measurement taken under the same
 * conditions every time, so the value is in the comparison between two runs,
 * not in the number itself.
 *
 * One file serves both uses — importable module and command-line tool — rather
 * than being copied. Two copies drift, and then you are comparing two
 * different things.
 *
 *   npm run measure:speed                       (production)
 *   npm run measure:speed -- http://localhost:3000/en
 */
import { chromium } from "playwright-core";
import { pathToFileURL } from "node:url";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";

/** Moto G Power-ish: the profile Lighthouse uses for mobile. */
const MOBILE = {
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
};

const THROTTLE = {
  // Roughly a fast 3G link, so a heavy page is actually punished.
  downloadThroughput: (1.6 * 1024 * 1024) / 8,
  uploadThroughput: (750 * 1024) / 8,
  latency: 150,
};

async function measureOnce(browser, url) {
  const ctx = await browser.newContext(MOBILE);
  const page = await ctx.newPage();

  const client = await ctx.newCDPSession(page);
  await client.send("Network.enable");
  await client.send("Network.emulateNetworkConditions", { offline: false, ...THROTTLE });
  await client.send("Emulation.setCPUThrottlingRate", { rate: 4 });

  let transferred = 0;
  page.on("response", (r) => {
    transferred += Number(r.headers()["content-length"] ?? 0);
  });

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
  // The hero video loops forever, so networkidle never fires. Settle instead.
  await page.waitForTimeout(6000);

  const metrics = await page.evaluate(
    () =>
      new Promise((resolve) => {
        let lcp = null;
        try {
          new PerformanceObserver((l) => {
            lcp = l.getEntries().at(-1);
          }).observe({ type: "largest-contentful-paint", buffered: true });
        } catch {
          // not supported, leave null
        }
        setTimeout(() => {
          const nav = performance.getEntriesByType("navigation")[0];
          const paint = Object.fromEntries(
            performance.getEntriesByType("paint").map((p) => [p.name, Math.round(p.startTime)])
          );
          resolve({
            ttfb: Math.round(nav?.responseStart ?? 0),
            fcp: paint["first-contentful-paint"] ?? null,
            lcp: lcp ? Math.round(lcp.startTime) : null,
            lcpElement: lcp?.element?.tagName ?? null,
            domContentLoaded: Math.round(nav?.domContentLoadedEventEnd ?? 0),
            load: Math.round(nav?.loadEventEnd ?? 0),
          });
        }, 1200);
      })
  );

  await ctx.close();
  return { ...metrics, transferredKb: Math.round(transferred / 1024) };
}

const median = (xs) => {
  const clean = xs.filter((x) => typeof x === "number" && Number.isFinite(x)).sort((a, b) => a - b);
  if (!clean.length) return null;
  return clean[Math.floor(clean.length / 2)];
};

/**
 * Runs the page `runs` times and returns the median of each metric, plus the
 * spread between the fastest and slowest run.
 *
 * The spread is not decoration: before calling any change an improvement,
 * compare it against the spread between two runs of the same build. A gain
 * that fits inside the noise is not a gain.
 */
export async function measureSpeed(url, runs = 3) {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  try {
    const samples = [];
    for (let i = 0; i < runs; i++) samples.push(await measureOnce(browser, url));

    const pick = (key) => median(samples.map((s) => s[key]));
    const spread = (key) => {
      const xs = samples.map((s) => s[key]).filter((x) => Number.isFinite(x));
      return xs.length ? Math.max(...xs) - Math.min(...xs) : null;
    };

    return {
      url,
      runs,
      lcp: pick("lcp"),
      fcp: pick("fcp"),
      ttfb: pick("ttfb"),
      load: pick("load"),
      transferredKb: pick("transferredKb"),
      lcpElement: samples.find((s) => s.lcpElement)?.lcpElement ?? null,
      noise: { lcp: spread("lcp"), fcp: spread("fcp"), load: spread("load") },
      samples,
    };
  } finally {
    await browser.close();
  }
}

// --- command line ---
// pathToFileURL rather than building the string by hand: on Windows the module
// URL carries three slashes and a drive letter, which "file://" + path misses,
// so the tool silently did nothing.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const url = process.argv[2] ?? "https://www.afrobirthday.com/en";
  const runs = Number(process.argv[3]) || 3;
  const r = await measureSpeed(url, runs);

  console.log(`${r.url}  —  mediane de ${r.runs} chargements, mobile bride 4x CPU / 1.6 Mbps\n`);
  const line = (label, value, unit = "ms") =>
    console.log(`  ${label.padEnd(16)} ${String(value ?? "-").padStart(6)} ${unit}`);
  line("LCP", r.lcp);
  line("FCP", r.fcp);
  line("TTFB", r.ttfb);
  line("load", r.load);
  line("transfere", r.transferredKb, "Ko");
  console.log(`  ${"element LCP".padEnd(16)} ${r.lcpElement ?? "-"}`);
  console.log(
    `\n  bruit entre passages : LCP +/-${r.noise.lcp ?? "-"} ms, FCP +/-${r.noise.fcp ?? "-"} ms`
  );
  console.log("  Un gain inferieur a ce bruit n'est pas un gain.");
}
