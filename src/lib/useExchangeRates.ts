"use client";

import { useEffect, useState } from "react";
import { CURRENCY_RATES, type CurrencyCode } from "@/lib/utils";

type ExchangeRatesPayload = {
  base: "USD";
  rates: Record<CurrencyCode, number>;
  provider: string;
  fetchedAt: string;
};

const STORAGE_KEY = "afrobirthday_exchange_rates_v1";
const MAX_AGE_MS = 60 * 60 * 1000;

export function useExchangeRates() {
  const [rates, setRates] = useState<Record<CurrencyCode, number>>(CURRENCY_RATES);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const cachedRaw = localStorage.getItem(STORAGE_KEY);
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw) as { payload: ExchangeRatesPayload; savedAt: number };
          if (Date.now() - cached.savedAt < MAX_AGE_MS) {
            setRates(cached.payload.rates);
            setFetchedAt(cached.payload.fetchedAt);
            setLoading(false);
            return;
          }
        }

        const res = await fetch("/api/exchange-rates", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to fetch exchange rates");
        const payload = (await res.json()) as ExchangeRatesPayload;

        setRates(payload.rates);
        setFetchedAt(payload.fetchedAt);
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ payload, savedAt: Date.now() }));
      } catch {
        setRates(CURRENCY_RATES);
        setFetchedAt(null);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  return { rates, fetchedAt, loading };
}
