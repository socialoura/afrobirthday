import { locales, defaultLocale } from "@/i18n/config";

/**
 * Builds the `alternates` object expected by Next.js `Metadata`, including
 * canonical + hreflang languages + x-default. Pass the path without the
 * locale segment, e.g. "/faq", "/about", or "" for the root.
 */
export function buildAlternates(locale: string, path: string = "") {
  const cleanPath = path === "/" ? "" : path;
  const languages = Object.fromEntries(
    locales.map((l) => [l, `/${l}${cleanPath}`])
  );
  return {
    canonical: `/${locale}${cleanPath}`,
    languages: {
      ...languages,
      "x-default": `/${defaultLocale}${cleanPath}`,
    },
  };
}
