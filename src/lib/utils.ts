import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type CurrencyCode = "USD" | "EUR" | "GBP" | "CAD" | "AUD";

export const CURRENCY_RATES: Record<CurrencyCode, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  CAD: 1.36,
  AUD: 1.53,
};

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  CAD: "CA$",
  AUD: "A$",
};

export function formatPrice(price: number, currency: CurrencyCode = "USD"): string {
  const convertedPrice = price * CURRENCY_RATES[currency];
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
  }).format(convertedPrice);
}

export function formatPriceSimple(price: number, currency: CurrencyCode = "USD"): string {
  const convertedPrice = price * CURRENCY_RATES[currency];
  return `${CURRENCY_SYMBOLS[currency]}${convertedPrice.toFixed(2)}`;
}

export const PRICES = {
  base: 19.99,
  customSong: 9.99,
  expressDelivery: 7.99,
} as const;
