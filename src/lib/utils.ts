import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type CurrencyCode =
  | "USD"
  | "EUR"
  | "GBP"
  | "CAD"
  | "AUD"
  | "BRL"
  | "MXN"
  | "INR"
  | "CNY"
  | "JPY"
  | "ZAR"
  | "AED"
  | "SAR";

export const SUPPORTED_CURRENCIES: ReadonlyArray<CurrencyCode> = [
  "USD",
  "EUR",
  "GBP",
  "CAD",
  "AUD",
  "BRL",
  "MXN",
  "INR",
  "CNY",
  "JPY",
  "ZAR",
  "AED",
  "SAR",
];

// Fallback rates against USD, used only when the live exchange-rate API fails.
export const CURRENCY_RATES: Record<CurrencyCode, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  CAD: 1.36,
  AUD: 1.53,
  BRL: 5.0,
  MXN: 17.0,
  INR: 83.0,
  CNY: 7.2,
  JPY: 150.0,
  ZAR: 18.5,
  AED: 3.67,
  SAR: 3.75,
};

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  CAD: "CA$",
  AUD: "A$",
  BRL: "R$",
  MXN: "MX$",
  INR: "₹",
  CNY: "¥",
  JPY: "¥",
  ZAR: "R",
  AED: "د.إ",
  SAR: "﷼",
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

/**
 * Maps a BCP-47 locale (e.g. "fr-FR", "ar-SA", "pt-BR") to its most likely
 * local currency. Used to show "estimated local price" while always charging
 * in USD on the server side.
 */
export function currencyFromLocale(locale: string): CurrencyCode {
  const region = locale.split("-")[1]?.toUpperCase();

  if (!region) {
    // Language-only fallback (e.g. "ar", "zh", "hi")
    const lang = locale.toLowerCase();
    if (lang === "ar") return "AED";
    if (lang === "zh") return "CNY";
    if (lang === "hi") return "INR";
    if (lang === "pt") return "BRL";
    if (lang === "ja") return "JPY";
    if (lang === "es") return "EUR";
    if (lang === "fr" || lang === "de" || lang === "it" || lang === "nl") return "EUR";
    return "USD";
  }

  if (region === "GB") return "GBP";
  if (region === "CA") return "CAD";
  if (region === "AU" || region === "NZ") return "AUD";
  if (region === "BR") return "BRL";
  if (region === "MX") return "MXN";
  if (region === "IN") return "INR";
  if (region === "CN" || region === "HK" || region === "TW" || region === "SG") return "CNY";
  if (region === "JP") return "JPY";
  if (region === "ZA") return "ZAR";
  if (region === "AE") return "AED";
  if (region === "SA" || region === "KW" || region === "BH" || region === "OM" || region === "QA") return "SAR";

  const EURO_REGIONS = new Set([
    "FR", "DE", "ES", "IT", "NL", "BE", "PT", "IE", "AT",
    "FI", "GR", "LU", "EE", "LV", "LT", "SK", "SI", "MT", "CY", "HR",
  ]);
  if (EURO_REGIONS.has(region)) return "EUR";

  return "USD";
}
