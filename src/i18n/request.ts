import { getRequestConfig } from "next-intl/server";
import { notFound } from "next/navigation";
import { defaultLocale, locales } from "@/i18n/config";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMerge(
  base: Record<string, unknown>,
  override: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(override)) {
    const baseValue = result[key];
    if (isObject(baseValue) && isObject(value)) {
      result[key] = deepMerge(baseValue, value);
      continue;
    }
    result[key] = value;
  }

  return result;
}

export default getRequestConfig(async ({ locale }) => {
  const resolvedLocale = (locale ?? defaultLocale) as never;

  if (!locales.includes(resolvedLocale)) {
    notFound();
  }

  const enMessages = (await import(`../../messages/en.json`)).default as Record<
    string,
    unknown
  >;
  const localeMessages = (
    resolvedLocale === "en"
      ? {}
      : ((await import(`../../messages/${resolvedLocale}.json`)).default as Record<
          string,
          unknown
        >)
  ) as Record<string, unknown>;

  const messages = deepMerge(enMessages, localeMessages);
  return { locale: resolvedLocale, messages };
});
