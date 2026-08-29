#!/usr/bin/env node
/**
 * Cross-checks the declared analytics events against what the code actually
 * emits.
 *
 * A declared event that is never emitted is a lie in the documentation.
 * An emitted event that is not declared should not compile — this catches the
 * cases TypeScript cannot, such as a raw posthog.capture() call that bypasses
 * captureEvent entirely.
 *
 * Exits non-zero on any mismatch so it can gate CI.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const SRC = join(ROOT, "src");
const CATALOGUE = join(SRC, "lib", "analyticsEvents.ts");

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(full)) out.push(full);
  }
  return out;
}

// --- declared ---
const catalogueSource = readFileSync(CATALOGUE, "utf8");
const declared = new Map();
for (const m of catalogueSource.matchAll(/^\s{2}([A-Z0-9_]+):\s*"([a-z0-9_]+)",/gm)) {
  declared.set(m[2], m[1]);
}

// --- emitted ---
const files = walk(SRC).filter((f) => f !== CATALOGUE);
const emitted = new Map(); // name -> [file:line]
const rawCaptures = []; // capture calls that skip the catalogue

for (const file of files) {
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, i) => {
    const where = `${relative(ROOT, file).replace(/\\/g, "/")}:${i + 1}`;

    for (const m of line.matchAll(/ANALYTICS_EVENTS\.([A-Z0-9_]+)/g)) {
      const constant = m[1];
      const name = [...declared.entries()].find(([, c]) => c === constant)?.[0];
      if (!name) {
        rawCaptures.push(`${where}  ANALYTICS_EVENTS.${constant} n'existe pas dans le catalogue`);
        continue;
      }
      if (!emitted.has(name)) emitted.set(name, []);
      emitted.get(name).push(where);
    }

    // A literal string handed to posthog.capture bypasses the type entirely.
    const raw = line.match(/posthog\.capture\(\s*["'`]([^"'`]+)["'`]/);
    if (raw) rawCaptures.push(`${where}  posthog.capture("${raw[1]}") contourne captureEvent`);
  });
}

// --- report ---
const neverEmitted = [...declared.keys()].filter((n) => !emitted.has(n));

console.log(`catalogue : ${declared.size} evenements declares`);
console.log(`code      : ${emitted.size} evenements emis\n`);

let failed = false;

if (neverEmitted.length) {
  failed = true;
  console.log("DECLARES MAIS JAMAIS EMIS");
  for (const n of neverEmitted) console.log(`  ${n}`);
  console.log();
}

if (rawCaptures.length) {
  failed = true;
  console.log("APPELS QUI CONTOURNENT LE CATALOGUE");
  for (const r of rawCaptures) console.log(`  ${r}`);
  console.log();
}

if (!failed) {
  console.log("OK — chaque evenement declare est emis, et aucun appel ne contourne le catalogue.");
  for (const [name, places] of [...emitted].sort()) {
    console.log(`  ${name.padEnd(30)} ${places.length} appel(s)`);
  }
}

process.exit(failed ? 1 : 0);
