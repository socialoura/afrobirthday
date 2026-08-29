import { SITE_URL } from "@/lib/siteUrl";

/**
 * Campaign tagging for every link the site sends by e-mail.
 *
 * Without it the whole channel is invisible from both ends: a customer who
 * comes back from a reminder arrives as direct traffic, indistinguishable from
 * someone typing the address in, and there is no denominator to divide by.
 *
 * The campaign names are a closed set on purpose — a typo would otherwise
 * create a twin campaign that splits the numbers in half without anyone
 * noticing, the same failure mode the analytics event catalogue prevents.
 */
export const EMAIL_CAMPAIGNS = {
  ORDER_CONFIRMATION: "order_confirmation",
  FINAL_VIDEO: "final_video",
  ABANDONED_CART: "abandoned_cart",
  REVIEW_REQUEST: "review_request",
  CROSS_SELL: "cross_sell",
  ANNUAL_REMINDER: "annual_reminder",
  REFERRAL_CODE: "referral_code",
  REFERRAL_REWARD: "referral_reward",
} as const;

export type EmailCampaign = (typeof EMAIL_CAMPAIGNS)[keyof typeof EMAIL_CAMPAIGNS];

/**
 * Adds campaign parameters to an outbound e-mail link.
 *
 * Existing query strings are preserved rather than overwritten: several links
 * already carry a signed token, and losing it would break the link entirely.
 * Relative paths resolve against the site origin.
 *
 * Never call this on an unsubscribe link — tagging it would fill the
 * acquisition reports with people who are leaving.
 */
export function withCampaign(
  url: string,
  campaign: EmailCampaign,
  content?: string
): string {
  let parsed: URL;
  try {
    parsed = new URL(url, SITE_URL);
  } catch {
    return url;
  }

  parsed.searchParams.set("utm_source", "email");
  parsed.searchParams.set("utm_medium", "email");
  parsed.searchParams.set("utm_campaign", campaign);
  if (content) parsed.searchParams.set("utm_content", content);

  return parsed.toString();
}
