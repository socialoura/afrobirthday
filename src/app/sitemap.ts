import type { MetadataRoute } from "next";
import { locales } from "@/i18n/config";
import { SITE_URL } from "@/lib/siteUrl";
import { SEO_STATIC_PATHS } from "@/lib/seoUrls";

const SITE = SITE_URL;

// Shared with the indexation probe, so the pages declared to Google and the
// pages whose indexing is measured can never drift apart.
const STATIC_PATHS = SEO_STATIC_PATHS;

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
