import type { NextRequest } from "next/server";
import { locales } from "@/i18n/config";
import { parseCheckoutVariant } from "@/lib/checkoutVariant";

/**
 * Per-request details stored on an order for ad measurement. IP, user agent
 * and the OpenAI click reference (oppref) are only persisted when the visitor
 * consented (see createOrder), and only used for the Conversions API.
 */
export function orderRequestContext(request: NextRequest, body: Record<string, unknown>) {
  const locale =
    typeof body.locale === "string" && (locales as readonly string[]).includes(body.locale)
      ? body.locale
      : undefined;
  // The ad click carries ?oppref=..., captured by src/lib/attribution.ts as a
  // click id; the Conversions API wants the original value back.
  const attribution = (body.attribution ?? {}) as { clickId?: unknown; last?: { clickId?: unknown } };
  const clickIds = [attribution.last?.clickId, attribution.clickId];
  const oppref = clickIds
    .find((id): id is string => typeof id === "string" && id.startsWith("oppref="))
    ?.slice("oppref=".length);
  const forwardedFor = request.headers.get("x-forwarded-for");
  const clientIp = forwardedFor?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || undefined;
  return {
    locale,
    adsConsent: body.adsConsent === true,
    oaiRef: oppref?.slice(0, 280),
    clientIp: clientIp?.slice(0, 64),
    clientUserAgent: request.headers.get("user-agent")?.slice(0, 400) ?? undefined,
    checkoutVariant: parseCheckoutVariant(body.checkoutVariant),
  };
}
