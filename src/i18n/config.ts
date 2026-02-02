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
