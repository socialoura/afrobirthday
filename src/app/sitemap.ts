import type { MetadataRoute } from "next";
import { locales } from "@/i18n/config";
import { SITE_URL } from "@/lib/siteUrl";

const SITE = SITE_URL;

const STATIC_PATHS = [
  "",
  "/how-to-order",
  "/our-story",
  "/faq",
  "/about",
  "/privacy",
  "/refund",
  "/terms",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return STATIC_PATHS.flatMap((path) =>
    locales.map((locale) => {
      const url = `${SITE}/${locale}${path}`;
      const languages = Object.fromEntries(
        locales.map((l) => [l, `${SITE}/${l}${path}`])
      );
      return {
        url,
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: path === "" ? 1 : 0.7,
        alternates: {
          languages: {
            ...languages,
            "x-default": `${SITE}/en${path}`,
          },
        },
      };
    })
  );
}
