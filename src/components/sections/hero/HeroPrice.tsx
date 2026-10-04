"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { type CurrencyCode, currencyFromLocale, PRICES } from "@/lib/utils";
import { useExchangeRates } from "@/lib/useExchangeRates";
import { resolveLocalPriceComponent } from "@/lib/currency";

/**
 * The hero's price, in the visitor's currency. Client-only because it depends
 * on the browser locale, live pricing and exchange rates; the rest of the
 * hero is rendered on the server.
 */
export default function HeroPrice() {
  const tHero = useTranslations("Hero");
  const [localCurrency, setLocalCurrency] = useState<CurrencyCode>("USD");
  const [browserLocale, setBrowserLocale] = useState("en-US");
  const [basePriceUsd, setBasePriceUsd] = useState<number>(PRICES.base);
  const [baseOverrides, setBaseOverrides] = useState<Partial<Record<CurrencyCode, number>>>({});
  const [pricingLoaded, setPricingLoaded] = useState(false);
  const { rates, loading: ratesLoading } = useExchangeRates();
  const priceReady = pricingLoaded && !ratesLoading;

  useEffect(() => {
    const nextLocale = navigator.language || "en-US";
    setBrowserLocale(nextLocale);
    setLocalCurrency(currencyFromLocale(nextLocale));
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadPricing = async () => {
      try {
        const res = await fetch("/api/pricing", { method: "GET" });
        if (!res.ok) return;
        const data = (await res.json()) as Partial<{
          base: number;
          overrides: Partial<Record<CurrencyCode, Partial<{ base: number }>>>;
        }>;
        if (!isMounted) return;
        if (typeof data.base === "number" && Number.isFinite(data.base)) {
          setBasePriceUsd(data.base);
        }
        if (data.overrides && typeof data.overrides === "object") {
          const bases: Partial<Record<CurrencyCode, number>> = {};
          for (const [code, value] of Object.entries(data.overrides)) {
            if (typeof value?.base === "number" && Number.isFinite(value.base)) {
              bases[code as CurrencyCode] = value.base;
            }
          }
          setBaseOverrides(bases);
        }
      } catch {
        // ignore
      } finally {
        if (isMounted) setPricingLoaded(true);
      }
    };

    loadPricing();

    return () => {
      isMounted = false;
    };
  }, []);

  // Same rule as the order form and the payment routes (EUR parity, then
  // overrides, then the live rate), so the hero never advertises a price the
  // checkout does not charge.
  const displayPrice = useMemo(() => {
    const rate = localCurrency === "USD" ? 1 : rates[localCurrency] ?? 1;
    const local = resolveLocalPriceComponent({
      usdPrice: basePriceUsd,
      currency: localCurrency,
      rate,
      override: baseOverrides[localCurrency],
    });
    return new Intl.NumberFormat(browserLocale, {
      style: "currency",
      currency: localCurrency,
      maximumFractionDigits: 2,
    }).format(local);
  }, [baseOverrides, localCurrency, browserLocale, basePriceUsd, rates]);

  return (
    <>
      <div className="inline-flex items-center gap-3 mb-7 px-5 py-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
        {/* No struck-through "was" price: in the EU it must be the lowest
            price of the previous 30 days, which a fixed anchor never was. */}
        {priceReady ? (
          <span className="text-3xl sm:text-4xl font-bold text-white">{displayPrice}</span>
        ) : (
          <span className="h-9 w-40 rounded-lg bg-white/10 animate-pulse" aria-hidden="true" />
        )}
      </div>

      {priceReady && localCurrency !== "USD" && (
        <p className="text-white/60 text-xs sm:text-sm mb-6 -mt-3">{tHero("localCurrencyNote")}</p>
      )}
    </>
  );
}
