import { getSql } from "@/lib/db";
import { isGscConfigured, querySearchAnalytics } from "@/lib/gsc";

/**
 * The weekly funnel, from two sources that are authoritative.
 *
 * Search Console for impressions and clicks, the orders table for orders
 * created and paid. Weekly rather than daily: at this volume a day measures
 * nothing but noise.
 *
 * What is deliberately missing: page views and form starts. Those live only in
 * the browser, behind ad blockers and consent, and mixing them in would
 * produce a conversion rate that looks precise and is not. The gap is left
 * visible rather than papered over.
 */

/** Search Console lags two to three days; asking for yesterday returns nothing. */
const GSC_LAG_DAYS = 3;

/**
 * Below this many clicks in the reference week, a change is not reported as a
 * change. Going from 4 clicks to 1 means nothing, and alerting on it is how an
 * alert stops being read.
 */
const MIN_CLICKS_TO_COMPARE = 25;

export type FunnelWeek = {
  weekStart: string;
  impressions: number;
  clicks: number;
  ordersCreated: number;
  ordersPaid: number;
};

export type FunnelStats = {
  current: FunnelWeek;
  previous: FunnelWeek;
  /** Null when the previous week was too small to compare against. */
  clicksChange: number | null;
  belowThreshold: boolean;
  skipped?: string;
};

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function runFunnelProbe(): Promise<FunnelStats | { skipped: string }> {
  if (!isGscConfigured()) return { skipped: "GSC not configured" };

  const end = new Date(Date.now() - GSC_LAG_DAYS * 86_400_000);
  const currentStart = new Date(end.getTime() - 6 * 86_400_000);
  const previousEnd = new Date(currentStart.getTime() - 86_400_000);
  const previousStart = new Date(previousEnd.getTime() - 6 * 86_400_000);

  const rows = await querySearchAnalytics(isoDay(previousStart), isoDay(end));

  const sum = (from: Date, to: Date) =>
    rows
      .filter((r) => r.date >= isoDay(from) && r.date <= isoDay(to))
      .reduce(
        (acc, r) => ({
          impressions: acc.impressions + r.impressions,
          clicks: acc.clicks + r.clicks,
        }),
        { impressions: 0, clicks: 0 }
      );

  const sql = getSql();
  const orders = async (from: Date, to: Date) => {
    const [row] = await sql<{ created: string; paid: string }[]>`
      SELECT count(*) AS created,
             count(*) FILTER (WHERE status = 'paid') AS paid
      FROM orders
      WHERE created_at >= ${isoDay(from)}::date
        AND created_at < (${isoDay(to)}::date + interval '1 day')
    `;
    return { created: Number(row?.created ?? 0), paid: Number(row?.paid ?? 0) };
  };

  const [currentSearch, previousSearch, currentOrders, previousOrders] = await Promise.all([
    Promise.resolve(sum(currentStart, end)),
    Promise.resolve(sum(previousStart, previousEnd)),
    orders(currentStart, end),
    orders(previousStart, previousEnd),
  ]);

  const current: FunnelWeek = {
    weekStart: isoDay(currentStart),
    ...currentSearch,
    ordersCreated: currentOrders.created,
    ordersPaid: currentOrders.paid,
  };
  const previous: FunnelWeek = {
    weekStart: isoDay(previousStart),
    ...previousSearch,
    ordersCreated: previousOrders.created,
    ordersPaid: previousOrders.paid,
  };

  const belowThreshold = previous.clicks < MIN_CLICKS_TO_COMPARE;

  return {
    current,
    previous,
    clicksChange:
      belowThreshold || previous.clicks === 0
        ? null
        : Math.round(((current.clicks - previous.clicks) / previous.clicks) * 100),
    belowThreshold,
  };
}
