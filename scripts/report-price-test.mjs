#!/usr/bin/env node
/**
 * Prints the price test report in the terminal.
 *
 *   npm run report:price-test
 *
 * Same computation as /admin/price-test — both call buildPriceTestReport, so
 * the two can never disagree.
 */
import { buildPriceTestReport } from "../src/lib/priceTestReport.ts";
import { getSql } from "../src/lib/db.ts";

const r = await buildPriceTestReport();
const pct = (x) => `${(100 * x).toFixed(1)} %`;
const usd = (x) => `$${x.toFixed(2)}`;
const ci = ([a, b], f) => `[${f(a)} ; ${f(b)}]`;

if (!r.test) {
  console.log(r.verdict.message);
  process.exit(0);
}

console.log(`Test : ${r.test.description}`);
console.log(`Démarré : ${r.test.startedAt}${r.test.endedAt ? ` — terminé : ${r.test.endedAt}` : ""}`);
console.log(`Témoin : ${r.test.controlCurrencies.join(", ")} (prix inchangé)\n`);

const rows = [
  ["", "test avant", "test après", "témoin avant", "témoin après"],
  ...[
    ["visiteurs", (c) => (c.visitors ?? "-").toString()],
    ["clients au paiement", (c) => c.customers.toString()],
    ["payants", (c) => c.payers.toString()],
    ["conversion", (c) => pct(c.conversion)],
    ["  intervalle 95 %", (c) => ci(c.conversionCi, (x) => `${(100 * x).toFixed(0)}%`)],
    ["CA / client", (c) => usd(c.revenuePerCustomer)],
    ["  intervalle 95 %", (c) => ci(c.revenuePerCustomerCi, (x) => `$${x.toFixed(1)}`)],
    ["CA / visiteur", (c) => (c.revenuePerVisitor == null ? "-" : usd(c.revenuePerVisitor))],
    ["panier moyen", (c) => usd(c.averageOrderUsd)],
    ["avec option", (c) => pct(c.optionRate)],
  ].map(([label, f]) => [
    label,
    f(r.cells.test.before),
    f(r.cells.test.after),
    f(r.cells.control.before),
    f(r.cells.control.after),
  ]),
];
const widths = rows[0].map((_, i) => Math.max(...rows.map((row) => String(row[i]).length)));
for (const row of rows) console.log(row.map((v, i) => String(v).padEnd(widths[i] + 2)).join(""));

if (r.diffInDiff) {
  console.log("\nEffet estimé de la hausse (différence de différences) :");
  console.log(`  conversion : ${(100 * r.diffInDiff.conversion.estimate).toFixed(1)} points  ${ci(r.diffInDiff.conversion.ci, (x) => `${(100 * x).toFixed(1)}`)}`);
  console.log(`  CA / client : ${usd(r.diffInDiff.revenuePerCustomer.estimate)}  ${ci(r.diffInDiff.revenuePerCustomer.ci, (x) => `$${x.toFixed(2)}`)}`);
}

console.log(`\nVerdict : ${r.verdict.message}\n`);
for (const n of r.notes) console.log(`  · ${n}`);
// Close the pool first: exiting with it open trips a libuv assertion on Windows.
await getSql().end({ timeout: 5 });
process.exit(0);
