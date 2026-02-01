import { NextResponse } from "next/server";

export const runtime = "nodejs";

const SUPPORTED = ["USD", "EUR", "GBP", "CAD", "AUD"] as const;

type CurrencyCode = (typeof SUPPORTED)[number];

type RatesResponse = {
  base: CurrencyCode;
  rates: Record<CurrencyCode, number>;
  provider: "frankfurter";
  fetchedAt: string;
};

export async function GET() {
  const url = "https://api.frankfurter.app/latest?from=USD";

  const res = await fetch(url, {
    next: { revalidate: 60 * 60 },
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: "Failed to fetch exchange rates" },
      {
        status: 502,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }

  const data: { base: string; rates: Record<string, number> } = await res.json();

  const rates: Record<CurrencyCode, number> = {
    USD: 1,
    EUR: typeof data.rates.EUR === "number" ? data.rates.EUR : 0,
    GBP: typeof data.rates.GBP === "number" ? data.rates.GBP : 0,
    CAD: typeof data.rates.CAD === "number" ? data.rates.CAD : 0,
    AUD: typeof data.rates.AUD === "number" ? data.rates.AUD : 0,
  };

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
}
