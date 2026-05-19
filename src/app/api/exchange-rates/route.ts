import { NextResponse } from "next/server";
import {
  CURRENCY_RATES,
  SUPPORTED_CURRENCIES,
  type CurrencyCode,
} from "@/lib/utils";

export const runtime = "nodejs";

type RatesResponse = {
  base: "USD";
  rates: Record<CurrencyCode, number>;
  provider: "frankfurter";
  fetchedAt: string;
};

export async function GET() {
  const symbols = SUPPORTED_CURRENCIES.filter((c) => c !== "USD").join(",");
  const url = `https://api.frankfurter.app/latest?from=USD&to=${symbols}`;

  try {
    const res = await fetch(url, { next: { revalidate: 60 * 60 } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = (await res.json()) as {
      base: string;
      rates: Record<string, number>;
    };

    const rates: Record<CurrencyCode, number> = { ...CURRENCY_RATES };
    for (const code of SUPPORTED_CURRENCIES) {
      if (code === "USD") continue;
      const val = data.rates?.[code];
      if (typeof val === "number" && Number.isFinite(val) && val > 0) {
        rates[code] = val;
      }
    }

    const payload: RatesResponse = {
      base: "USD",
      rates,
      provider: "frankfurter",
      fetchedAt: new Date().toISOString(),
    };

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    console.error("exchange-rates error:", err);
    return NextResponse.json(
      {
        base: "USD",
        rates: CURRENCY_RATES,
        provider: "frankfurter",
        fetchedAt: new Date(0).toISOString(),
      } satisfies RatesResponse,
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}
