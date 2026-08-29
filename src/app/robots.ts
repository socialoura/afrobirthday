import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteUrl";

const SITE = SITE_URL;

const DISALLOW = [
  "/admin",
  "/admin/*",
  "/api/*",
  "/success",
  "/paypal/*",
  "/*/success",
];

// AI retrieval crawlers, listed explicitly rather than left to the `*` rule.
// The wildcard already allows them, but an explicit entry is what the bot
// operators ask for and it survives any future tightening of the `*` rule.
//
// OAI-SearchBot matters most here: it is the crawler behind ChatGPT's search
// answers, and ChatGPT referrals are where the large majority of orders come
// from. ChatGPT-User is the user-triggered fetch (OpenAI notes robots.txt may
// not even apply to it); GPTBot is the training crawler.
// See https://developers.openai.com/api/docs/bots
const AI_CRAWLERS = [
  "OAI-SearchBot",
  "ChatGPT-User",
  "GPTBot",
  "PerplexityBot",
  "Perplexity-User",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "Google-Extended",
  "Bingbot",
  "Amazonbot",
  "Applebot",
  "Applebot-Extended",
  "cohere-ai",
  "meta-externalagent",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: DISALLOW,
      },
      ...AI_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: DISALLOW,
      })),
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
