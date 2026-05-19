export const locales = [
  "en",
  "fr",
  "es",
  "de",
  "it",
  "pt",
  "nl",
  "ar",
  "hi",
  "zh",
] as const;

export type AppLocale = (typeof locales)[number];

export const defaultLocale: AppLocale = "en";

export const RTL_LOCALES: ReadonlyArray<AppLocale> = ["ar"];

export function getTextDirection(locale: string): "ltr" | "rtl" {
  return RTL_LOCALES.includes(locale as AppLocale) ? "rtl" : "ltr";
}

export const LOCALE_LABELS: Record<AppLocale, { native: string; flag: string }> = {
  en: { native: "English", flag: "EN" },
  fr: { native: "Français", flag: "FR" },
  es: { native: "Español", flag: "ES" },
  de: { native: "Deutsch", flag: "DE" },
  it: { native: "Italiano", flag: "IT" },
  pt: { native: "Português", flag: "PT" },
  nl: { native: "Nederlands", flag: "NL" },
  ar: { native: "العربية", flag: "AR" },
  hi: { native: "हिन्दी", flag: "HI" },
  zh: { native: "中文", flag: "ZH" },
};
