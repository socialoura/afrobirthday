import { getSql } from "@/lib/db";
import { getPriceTestDefinition, type PriceTest } from "@/lib/priceTest";
import { hogql } from "@/lib/posthogQuery";
import { currencyFromLocale } from "@/lib/utils";

/**
 * Reads out the price test: did raising the price in the test currencies earn
 * more per customer than leaving the control currencies alone?
 *
 * Difference-in-differences, not a before/after of the test group alone.
 * Traffic, seasonality and a quiet week move both groups at once; subtracting
 * the control group's own change removes what the price did not cause.
 *
 * Everything is counted per customer — one e-mail address — not per order row,
 * so an abandoned card attempt followed by a PayPal payment is one customer who
 * paid, not one who left and one who paid.
 */

const DAY = 86_400_000;
/** Baseline length. Four weeks takes the weekday cycle out of the "before". */
const BASELINE_DAYS = 28;
/**
 * Below this many customers in any of the four cells, no verdict is given. At
 * this site's volume that is the honest default: a result on eight customers
 * is noise with a confident label on it.
 */
const MIN_CUSTOMERS_PER_CELL = 15;
const BOOTSTRAP_ITERATIONS = 2000;

const EURO_COUNTRIES = new Set([
  "FR", "DE", "ES", "IT", "NL", "BE", "PT", "IE", "AT", "FI", "GR", "LU",
  "EE", "LV", "LT", "SK", "SI", "MT", "CY", "HR",
]);

type Group = "test" | "control";
type Period = "before" | "after";

type Customer = { group: Group; period: Period; paid: boolean; revenueUsd: number; tookOption: boolean };

export type CellMetrics = {
  customers: number;
  payers: number;
  conversion: number;
  conversionCi: [number, number];
  revenueUsd: number;
  revenuePerCustomer: number;
  revenuePerCustomerCi: [number, number];
  averageOrderUsd: number;
  optionRate: number;
  visitors: number | null;
  revenuePerVisitor: number | null;
};

export type PriceTestReport = {
  test: PriceTest | null;
  generatedAt: string;
  windows: { before: { from: string; to: string }; after: { from: string; to: string } } | null;
  cells: Record<Group, Record<Period, CellMetrics>> | null;
  diffInDiff: {
    conversion: { estimate: number; ci: [number, number] };
    revenuePerCustomer: { estimate: number; ci: [number, number] };
  } | null;
  verdict: {
    status: "no_test" | "not_enough_data" | "winning" | "losing" | "inconclusive";
    message: string;
  };
  notes: string[];
};

// --- statistics -------------------------------------------------------------

/** Seeded, so the same data always gives the same interval on refresh. */
function seededRandom(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function wilson(k: number, n: number): [number, number] {
  if (n === 0) return [0, 0];
  const z = 1.96;
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const m = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [Math.max(0, (c - m) / d), Math.min(1, (c + m) / d)];
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))));
  return sorted[i];
}

function resample<T>(items: T[], rand: () => number): T[] {
  const out = new Array<T>(items.length);
  for (let i = 0; i < items.length; i++) out[i] = items[Math.floor(rand() * items.length)];
  return out;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

// --- data ---------------------------------------------------------------------

type OrderRow = {
  email: string;
  created_at: Date;
  status: string;
  currency: string | null;
  display_currency: string | null;
  total_local: string | null;
  exchange_rate: string | null;
  total_usd: string | null;
  payment_provider: string | null;
  country: string | null;
  music_option: string | null;
  delivery_method: string | null;
  dance_extended: boolean | null;
};

/**
 * The currency the customer was shown. Before display_currency existed, PayPal
 * orders were stored in USD whatever the customer saw; for those, the IP
 * country is the best proxy left. Card orders always carried the real one.
 */
function shownCurrency(r: OrderRow): string {
  if (r.display_currency) return r.display_currency.toUpperCase();
  if (r.payment_provider === "paypal") {
    const country = (r.country ?? "").toUpperCase();
    if (country === "GB") return "GBP";
    if (EURO_COUNTRIES.has(country)) return "EUR";
    return "USD";
  }
  return (r.currency ?? "USD").toUpperCase();
}

/**
 * What the charge was worth in dollars, recomputed from what was actually
 * collected. total_usd understated GBP and EUR sales until late August, so it
 * cannot be trusted across the whole baseline.
 */
function usdValue(r: OrderRow): number {
  const local = Number(r.total_local);
  const rate = Number(r.exchange_rate);
  if (Number.isFinite(local) && Number.isFinite(rate) && rate > 0) return local / rate;
  const usd = Number(r.total_usd);
  return Number.isFinite(usd) ? usd : 0;
}

async function loadCustomers(test: PriceTest, from: Date, start: Date, to: Date): Promise<Customer[]> {
  const sql = getSql();
  const rows = await sql<OrderRow[]>`
    SELECT email, created_at, status, currency, display_currency, total_local,
           exchange_rate, total_usd, payment_provider, country, music_option,
           delivery_method, dance_extended
    FROM orders
    WHERE email IS NOT NULL AND created_at >= ${from} AND created_at < ${to}
    ORDER BY created_at ASC
  `;

  const byEmail = new Map<string, { first: OrderRow; paid: boolean; revenue: number; option: boolean }>();
  for (const r of rows) {
    const key = r.email.trim().toLowerCase();
    let c = byEmail.get(key);
    if (!c) {
      c = { first: r, paid: false, revenue: 0, option: false };
      byEmail.set(key, c);
    }
    if (r.status === "paid") {
      c.paid = true;
      c.revenue += usdValue(r);
      if (r.music_option === "custom" || r.delivery_method === "express" || r.dance_extended) {
        c.option = true;
      }
    }
  }

  return [...byEmail.values()].map((c) => ({
    // A customer belongs to the period of their first attempt: that is the
    // price they arrived to.
    period: new Date(c.first.created_at).getTime() < start.getTime() ? "before" : "after",
    group: test.controlCurrencies.includes(shownCurrency(c.first)) ? "control" : "test",
    paid: c.paid,
    revenueUsd: c.revenue,
    tookOption: c.option,
  }));
}

async function loadVisitors(
  test: PriceTest,
  from: Date,
  start: Date,
  to: Date
): Promise<Record<Group, Record<Period, number>> | null> {
  try {
    const fmt = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");
    const rows = await hogql<[string | null, number, number]>(`
      SELECT properties.$browser_language AS lang,
             uniqIf(distinct_id, timestamp < toDateTime('${fmt(start)}', 'UTC')) AS before,
             uniqIf(distinct_id, timestamp >= toDateTime('${fmt(start)}', 'UTC')) AS after
      FROM events
      WHERE event = '$pageview'
        AND timestamp >= toDateTime('${fmt(from)}', 'UTC')
        AND timestamp < toDateTime('${fmt(to)}', 'UTC')
      GROUP BY lang
    `);
    const out: Record<Group, Record<Period, number>> = {
      test: { before: 0, after: 0 },
      control: { before: 0, after: 0 },
    };
    for (const [lang, before, after] of rows) {
      // The same mapping the order form uses to pick the currency, so a visitor
      // is counted in the group whose price they were actually shown.
      const currency = currencyFromLocale(lang || "en-US");
      const group: Group = test.controlCurrencies.includes(currency) ? "control" : "test";
      out[group].before += Number(before) || 0;
      out[group].after += Number(after) || 0;
    }
    return out;
  } catch (err) {
    console.error("Price test: visitor counts unavailable:", err);
    return null;
  }
}

function cellMetrics(customers: Customer[], visitors: number | null, rand: () => number): CellMetrics {
  const n = customers.length;
  const payers = customers.filter((c) => c.paid);
  const revenue = customers.reduce((s, c) => s + c.revenueUsd, 0);
  const perCustomer = customers.map((c) => c.revenueUsd);

  const boot: number[] = [];
  if (n > 0) {
    for (let i = 0; i < BOOTSTRAP_ITERATIONS; i++) boot.push(mean(resample(perCustomer, rand)));
    boot.sort((a, b) => a - b);
  }

  return {
    customers: n,
    payers: payers.length,
    conversion: n ? payers.length / n : 0,
    conversionCi: wilson(payers.length, n),
    revenueUsd: revenue,
    revenuePerCustomer: n ? revenue / n : 0,
    revenuePerCustomerCi: n ? [percentile(boot, 0.025), percentile(boot, 0.975)] : [0, 0],
    averageOrderUsd: payers.length ? revenue / payers.length : 0,
    optionRate: payers.length ? payers.filter((c) => c.tookOption).length / payers.length : 0,
    visitors,
    revenuePerVisitor: visitors ? revenue / visitors : null,
  };
}

// --- report -------------------------------------------------------------------

/**
 * `definition` overrides the stored test — for a what-if read of a start date
 * that has not happened, or to check the report before a test is switched on.
 */
export async function buildPriceTestReport(
  now = new Date(),
  definition?: PriceTest
): Promise<PriceTestReport> {
  const generatedAt = now.toISOString();
  const test = definition ?? (await getPriceTestDefinition());

  if (!test) {
    return {
      test: null,
      generatedAt,
      windows: null,
      cells: null,
      diffInDiff: null,
      verdict: { status: "no_test", message: "Aucun test de prix n'est défini." },
      notes: [],
    };
  }

  const start = new Date(test.startedAt);
  const end = test.endedAt ? new Date(test.endedAt) : now;
  const from = new Date(start.getTime() - BASELINE_DAYS * DAY);

  const [customers, visitors] = await Promise.all([
    loadCustomers(test, from, start, end),
    loadVisitors(test, from, start, end),
  ]);

  const rand = seededRandom(20260911);
  const pick = (g: Group, p: Period) => customers.filter((c) => c.group === g && c.period === p);

  const cells = {
    test: {
      before: cellMetrics(pick("test", "before"), visitors?.test.before ?? null, rand),
      after: cellMetrics(pick("test", "after"), visitors?.test.after ?? null, rand),
    },
    control: {
      before: cellMetrics(pick("control", "before"), visitors?.control.before ?? null, rand),
      after: cellMetrics(pick("control", "after"), visitors?.control.after ?? null, rand),
    },
  };

  // Difference-in-differences, with a bootstrap over customers in each cell.
  const tb = pick("test", "before");
  const ta = pick("test", "after");
  const cb = pick("control", "before");
  const ca = pick("control", "after");
  const conv = (xs: Customer[]) => (xs.length ? xs.filter((c) => c.paid).length / xs.length : 0);
  const rpc = (xs: Customer[]) => mean(xs.map((c) => c.revenueUsd));
  const did = (f: (xs: Customer[]) => number, a: Customer[], b: Customer[], c: Customer[], d: Customer[]) =>
    f(a) - f(b) - (f(c) - f(d));

  let diffInDiff: PriceTestReport["diffInDiff"] = null;
  if (tb.length && ta.length && cb.length && ca.length) {
    const convBoot: number[] = [];
    const rpcBoot: number[] = [];
    for (let i = 0; i < BOOTSTRAP_ITERATIONS; i++) {
      const [ra, rb, rc, rd] = [resample(ta, rand), resample(tb, rand), resample(ca, rand), resample(cb, rand)];
      convBoot.push(did(conv, ra, rb, rc, rd));
      rpcBoot.push(did(rpc, ra, rb, rc, rd));
    }
    convBoot.sort((a, b) => a - b);
    rpcBoot.sort((a, b) => a - b);
    diffInDiff = {
      conversion: {
        estimate: did(conv, ta, tb, ca, cb),
        ci: [percentile(convBoot, 0.025), percentile(convBoot, 0.975)],
      },
      revenuePerCustomer: {
        estimate: did(rpc, ta, tb, ca, cb),
        ci: [percentile(rpcBoot, 0.025), percentile(rpcBoot, 0.975)],
      },
    };
  }

  // Verdict.
  const smallest = Math.min(ta.length, ca.length, tb.length, cb.length);
  let verdict: PriceTestReport["verdict"];
  if (smallest < MIN_CUSTOMERS_PER_CELL) {
    // How long until the smallest "after" cell fills, at the baseline pace.
    const pace = (baseline: number) => baseline / BASELINE_DAYS;
    const daysFor = (have: number, baseline: number) =>
      have >= MIN_CUSTOMERS_PER_CELL || pace(baseline) === 0
        ? 0
        : Math.ceil((MIN_CUSTOMERS_PER_CELL - have) / pace(baseline));
    const moreDays = Math.max(daysFor(ta.length, tb.length), daysFor(ca.length, cb.length));
    verdict = {
      status: "not_enough_data",
      message:
        `Pas encore assez de données pour conclure : ${ta.length} clients côté test et ` +
        `${ca.length} côté témoin depuis le changement (minimum ${MIN_CUSTOMERS_PER_CELL} chacun). ` +
        (moreDays > 0 ? `Au rythme habituel, compter encore environ ${moreDays} jours.` : ""),
    };
  } else if (diffInDiff && diffInDiff.revenuePerCustomer.ci[0] > 0) {
    verdict = {
      status: "winning",
      message: "La hausse rapporte davantage par client, au-delà du bruit statistique.",
    };
  } else if (diffInDiff && diffInDiff.revenuePerCustomer.ci[1] < 0) {
    verdict = {
      status: "losing",
      message: "La hausse rapporte moins par client, au-delà du bruit statistique.",
    };
  } else {
    verdict = {
      status: "inconclusive",
      message:
        "Pas de différence mesurable pour l'instant : l'écart observé tient dans le bruit. " +
        "Ce n'est pas une preuve d'absence d'effet — seulement qu'il est trop petit pour être vu à ce volume.",
    };
  }

  return {
    test,
    generatedAt,
    windows: {
      before: { from: from.toISOString(), to: start.toISOString() },
      after: { from: start.toISOString(), to: end.toISOString() },
    },
    cells,
    diffInDiff,
    verdict,
    notes: [
      "Un client = une adresse e-mail, rattaché à la période de sa première tentative.",
      "Groupe = devise affichée. Pour les commandes PayPal antérieures au test, déduite du pays de l'IP.",
      "Chiffre d'affaires recalculé depuis le montant réellement encaissé et le taux appliqué.",
      "Visiteurs = identifiants PostHog (appareils), clients = e-mails : le taux visiteur → client est indicatif.",
      "Intervalles à 95 % par bootstrap sur les clients de chaque cellule.",
    ],
  };
}
