import type { Order } from "@/lib/db";
import { buildUnsubscribeUrl } from "@/lib/emailOptOut";
import { EMAIL_CAMPAIGNS, withCampaign, type EmailCampaign } from "@/lib/campaign";
import { emailCopy, emailLocale, fill } from "@/lib/emailCopy";

/**
 * Link back to the order form, tagged so the e-mail channel has a
 * denominator. Several of these messages handed out a promo code with no way
 * to spend it — the campaign was running with no destination at all.
 */
function orderUrl(campaign: EmailCampaign, order?: Order, promoCode?: string) {
  // The checkout reads ?promo= and applies the code itself: the promo field is
  // hidden on the site, so a code only typed into an e-mail was unusable.
  const locale = order ? emailLocale(order) : "en";
  const query = promoCode ? `?promo=${encodeURIComponent(promoCode)}` : "";
  return withCampaign(`/${locale}${query}#order`, campaign);
}

function orderLink(campaign: EmailCampaign, order?: Order, promoCode?: string) {
  return escapeHtml(orderUrl(campaign, order, promoCode));
}

/** Short order reference shown to customers (the full UUID is unreadable). */
export function orderRef(order: Order): string {
  return order.id.slice(0, 8).toUpperCase();
}

function formatOrderDate(order: Order): string {
  if (!order.created_at) return "";
  try {
    return new Intl.DateTimeFormat(emailLocale(order), {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "Europe/Paris",
    }).format(new Date(order.created_at));
  } catch {
    return new Date(order.created_at).toISOString().slice(0, 16).replace("T", " ");
  }
}

function dirAttr(order: Order): string {
  return emailLocale(order) === "ar" ? ` dir="rtl"` : "";
}

export function orderConfirmationSubject(order: Order): string {
  return fill(emailCopy(order).confirmSubject, { ref: orderRef(order) });
}

export function renderOrderConfirmationEmailHtml(order: Order) {
  const c = emailCopy(order);
  const createdAt = formatOrderDate(order);
  const delivery = order.delivery_method === "express" ? c.deliveryExpress : c.deliveryStandard;
  const music = order.music_option === "custom" ? c.musicCustom : c.musicDefault;

  return `
    <div${dirAttr(order)} style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; line-height: 1.5; color: #111;">
      <h2 style="margin:0 0 12px;">${c.confirmTitle}</h2>
      <p style="margin:0 0 16px;">${c.confirmIntro}</p>

      <div style="border:1px solid #eee; border-radius:12px; padding:16px;">
        <h3 style="margin:0 0 12px;">${c.details}</h3>
        <p style="margin:0 0 6px;"><strong>${c.orderRef}:</strong> ${orderRef(order)}</p>
        ${createdAt ? `<p style="margin:0 0 6px;"><strong>${c.date}:</strong> ${escapeHtml(createdAt)}</p>` : ""}
        <p style="margin:0 0 6px;"><strong>${c.total}:</strong> ${formatOrderTotal(order)}</p>
        <p style="margin:0 0 6px;"><strong>${c.delivery}:</strong> ${delivery}</p>
        <p style="margin:0 0 6px;"><strong>${c.music}:</strong> ${music}</p>
        ${order.music_link ? `<p style="margin:0 0 6px;"><strong>${c.musicLink}:</strong> ${escapeHtml(order.music_link)}</p>` : ""}
        ${order.dance_extended ? `<p style="margin:0 0 6px;"><strong>${c.danceExtended}:</strong> ${c.yes}</p>` : ""}
        <p style="margin:12px 0 0;"><strong>${c.message}:</strong><br/>${escapeHtml(order.message)}</p>
      </div>

      <p style="margin:16px 0 0;">${c.confirmOutro}</p>

      <p style="margin:16px 0 0; font-size: 12px; color: #555;">${c.help}</p>
    </div>
  `;
}

export function finalVideoSubject(order: Order): string {
  return fill(emailCopy(order).videoSubject, { ref: orderRef(order) });
}

export function renderFinalVideoEmailHtml(order: Order, videoUrl: string) {
  const c = emailCopy(order);
  const safeUrl = escapeHtml(videoUrl);
  return `
    <div${dirAttr(order)} style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 16px;">
      <p style="margin:0 0 16px;">${c.hi}</p>

      <p style="margin:0 0 16px;">${c.videoReady}</p>

      <p style="margin: 0 0 16px;">
        <a href="${safeUrl}" style="display:inline-block; background:#c2410c; color:#fff; text-decoration:none; font-weight:600; padding:12px 20px; border-radius:10px;">
          ${c.videoCta}
        </a>
      </p>

      <p style="margin:0 0 16px; font-size: 14px; color:#555;">
        ${c.videoFallback}<br/>
        <span style="word-break: break-all;">${safeUrl}</span>
      </p>

      <p style="margin:0 0 16px;">${fill(c.videoReference, { ref: `<strong>${orderRef(order)}</strong>` })}</p>

      <p style="margin:0 0 16px;">
        ${c.thanks}<br/>
        ${c.team}
      </p>

      <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />

      <p style="margin:0; font-size: 12px; color: #888;">
        ${c.footerTagline}<br/>
        Support: <a href="mailto:support@afrobirthday.com" style="color: #888;">support@afrobirthday.com</a><br/>
        ${c.footerReason}
      </p>
    </div>
  `;
}

export function renderFinalVideoEmailText(order: Order, videoUrl: string) {
  const c = emailCopy(order);
  return [
    c.hi,
    "",
    c.videoReady,
    videoUrl,
    "",
    fill(c.videoReference, { ref: orderRef(order) }),
    "",
    c.thanks,
    c.team,
    "",
    "—",
    c.footerTagline,
    "Support: support@afrobirthday.com",
    c.footerReason,
  ].join("\n");
}

export function renderOrderConfirmationEmailText(order: Order) {
  const c = emailCopy(order);
  const delivery = order.delivery_method === "express" ? c.deliveryExpress : c.deliveryStandard;
  const music = order.music_option === "custom" ? c.musicCustom : c.musicDefault;

  return [
    c.confirmTitle,
    "",
    c.confirmIntro,
    "",
    `${c.orderRef}: ${orderRef(order)}`,
    `${c.date}: ${formatOrderDate(order)}`,
    `${c.total}: ${formatOrderTotal(order)}`,
    `${c.delivery}: ${delivery}`,
    `${c.music}: ${music}`,
    order.music_link ? `${c.musicLink}: ${order.music_link}` : "",
    order.dance_extended ? `${c.danceExtended}: ${c.yes}` : "",
    "",
    `${c.message}:`,
    order.message,
    "",
    c.confirmOutro,
    c.help,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Shows the amount the customer was actually charged. When the order was paid
 * in a non-USD currency, the USD equivalent is appended for reference.
 */
function formatOrderTotal(order: Order) {
  const currency = (order.currency || "USD").toUpperCase();
  const usd = `$${Number(order.total_usd).toFixed(2)} USD`;

  if (currency === "USD" || order.total_local == null) {
    return usd;
  }

  const localValue = Number(order.total_local);
  let local: string;
  try {
    local = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(localValue);
  } catch {
    local = `${localValue.toFixed(2)} ${currency}`;
  }

  return `${local} (≈ ${usd})`;
}

type CopySource = { locale?: string | null };

/** Shared wrapper (font/width/footer) for the automated post-order emails below. */
function wrapEmailHtml(bodyHtml: string, unsubscribeUrl: string, source: CopySource) {
  const c = emailCopy(source);
  const dir = emailLocale(source) === "ar" ? ` dir="rtl"` : "";
  return `
    <div${dir} style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 16px;">
      ${bodyHtml}

      <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />

      <p style="margin:0; font-size: 12px; color: #888;">
        ${c.footerTagline}<br/>
        Support: <a href="mailto:support@afrobirthday.com" style="color: #888;">support@afrobirthday.com</a><br/>
        ${c.footerReason}<br/>
        <a href="${unsubscribeUrl}" style="color: #888; text-decoration: underline;">${c.unsubscribe}</a>
      </p>
    </div>
  `;
}

function wrapEmailText(bodyLines: string[], unsubscribeUrl: string, source: CopySource) {
  const c = emailCopy(source);
  return [
    ...bodyLines,
    "",
    "—",
    c.footerTagline,
    "Support: support@afrobirthday.com",
    c.footerReason,
    `${c.unsubscribe}: ${unsubscribeUrl}`,
  ].join("\n");
}

function formatDiscountLabel(source: CopySource, discountType: "percentage" | "fixed", discountValue: number) {
  const c = emailCopy(source);
  return fill(discountType === "percentage" ? c.discountPercent : c.discountFixed, {
    value: String(discountValue),
  });
}

const P = `style="margin:0 0 16px;"`;
const LINK = `style="color: #c2410c; text-decoration: underline; font-weight: 600;"`;
const CODE = `<p style="margin:0 0 16px; font-size: 18px;"><strong style="letter-spacing: 1px;">`;

function signOffHtml(source: CopySource) {
  const c = emailCopy(source);
  return `<p ${P}>${c.thanks}<br/>${c.team}</p>`;
}

/** Body of the marketing e-mails that hand out a promo code and an order link. */
function promoEmailHtml(order: Order, body: string, cta: string, link: string, promoCode: string) {
  const c = emailCopy(order);
  return wrapEmailHtml(`
    <p ${P}>${c.hi}</p>
    <p ${P}>${body}</p>
    ${CODE}${escapeHtml(promoCode)}</strong></p>
    <p ${P}><a href="${link}" ${LINK}>${cta}</a></p>
    ${signOffHtml(order)}
  `, buildUnsubscribeUrl(order.email), order);
}

function promoEmailText(order: Order, body: string, cta: string, url: string, promoCode: string) {
  const c = emailCopy(order);
  return wrapEmailText([
    c.hi, "", body, "", `${c.promoCodeLabel}: ${promoCode}`, "", `${cta}: ${url}`, "", c.thanks, c.team,
  ], buildUnsubscribeUrl(order.email), order);
}

const TRUSTPILOT_URL = "https://www.trustpilot.com/review/afrobirthday.com";

export function reviewRequestSubject(order: Order): string {
  return emailCopy(order).reviewSubject;
}

export function renderReviewRequestEmailHtml(order: Order) {
  const c = emailCopy(order);
  return wrapEmailHtml(`
    <p ${P}>${c.hi}</p>
    <p ${P}>${c.reviewBody}</p>
    <p ${P}><a href="${TRUSTPILOT_URL}" ${LINK}>${c.reviewCta}</a></p>
    ${signOffHtml(order)}
  `, buildUnsubscribeUrl(order.email), order);
}

export function renderReviewRequestEmailText(order: Order) {
  const c = emailCopy(order);
  return wrapEmailText([
    c.hi, "", c.reviewBody, "", `${c.reviewCta}: ${TRUSTPILOT_URL}`, "", c.thanks, c.team,
  ], buildUnsubscribeUrl(order.email), order);
}

export function crossSellSubject(order: Order): string {
  return emailCopy(order).crossSellSubject;
}

export function renderCrossSellEmailHtml(order: Order, promoCode: string) {
  const c = emailCopy(order);
  return promoEmailHtml(order, c.crossSellBody, c.crossSellCta, orderLink(EMAIL_CAMPAIGNS.CROSS_SELL, order, promoCode), promoCode);
}

export function renderCrossSellEmailText(order: Order, promoCode: string) {
  const c = emailCopy(order);
  return promoEmailText(order, c.crossSellBody, c.crossSellCta, orderUrl(EMAIL_CAMPAIGNS.CROSS_SELL, order, promoCode), promoCode);
}

export function annualReminderSubject(order: Order): string {
  return emailCopy(order).annualSubject;
}

export function renderAnnualReminderEmailHtml(order: Order, promoCode: string) {
  const c = emailCopy(order);
  return promoEmailHtml(order, c.annualBody, c.annualCta, orderLink(EMAIL_CAMPAIGNS.ANNUAL_REMINDER, order, promoCode), promoCode);
}

export function renderAnnualReminderEmailText(order: Order, promoCode: string) {
  const c = emailCopy(order);
  return promoEmailText(order, c.annualBody, c.annualCta, orderUrl(EMAIL_CAMPAIGNS.ANNUAL_REMINDER, order, promoCode), promoCode);
}

export function abandonedCartSubject(order: Order): string {
  return emailCopy(order).cartSubject;
}

export function renderAbandonedCartEmailHtml(order: Order, resumeUrl: string) {
  const c = emailCopy(order);
  const safeUrl = escapeHtml(resumeUrl);
  return wrapEmailHtml(`
    <p ${P}>${c.hi}</p>
    <p ${P}>${c.cartBody}</p>
    <p style="margin: 0 0 16px;">
      <a href="${safeUrl}" style="display:inline-block; background:#c2410c; color:#fff; text-decoration:none; font-weight:600; padding:12px 20px; border-radius:10px;">
        ${c.cartCta}
      </a>
    </p>
    <p ${P}>${c.team}</p>
  `, buildUnsubscribeUrl(order.email), order);
}

export function renderAbandonedCartEmailText(order: Order, resumeUrl: string) {
  const c = emailCopy(order);
  return wrapEmailText([c.hi, "", c.cartBody, resumeUrl, "", c.team], buildUnsubscribeUrl(order.email), order);
}

export function referralCodeSubject(order: Order): string {
  return emailCopy(order).referralSubject;
}

export function renderReferralCodeEmailHtml(
  order: Order,
  code: string,
  discountType: "percentage" | "fixed",
  discountValue: number
) {
  const c = emailCopy(order);
  const body = fill(c.referralBody, { discount: escapeHtml(formatDiscountLabel(order, discountType, discountValue)) });
  const link = orderLink(EMAIL_CAMPAIGNS.REFERRAL_CODE, order, code);
  return wrapEmailHtml(`
    <p ${P}>${c.hi}</p>
    <p ${P}>${body}</p>
    ${CODE}${escapeHtml(code)}</strong></p>
    <p ${P}>
      ${c.referralLinkIntro}<br/>
      <a href="${link}" style="color: #c2410c; text-decoration: underline; font-weight: 600; word-break: break-all;">${link}</a>
    </p>
    ${signOffHtml(order)}
  `, buildUnsubscribeUrl(order.email), order);
}

export function renderReferralCodeEmailText(
  order: Order,
  code: string,
  discountType: "percentage" | "fixed",
  discountValue: number
) {
  const c = emailCopy(order);
  const body = fill(c.referralBody, { discount: formatDiscountLabel(order, discountType, discountValue) });
  return wrapEmailText([
    c.hi,
    "",
    body,
    "",
    `${c.referralCodeLabel}: ${code}`,
    `${c.referralLinkIntro} ${orderUrl(EMAIL_CAMPAIGNS.REFERRAL_CODE, order, code)}`,
    "",
    c.thanks,
    c.team,
  ], buildUnsubscribeUrl(order.email), order);
}

/**
 * The referrer is not tied to an order here, only to an e-mail address:
 * `source` carries the locale of their latest order (defaults to English).
 */
export function referralRewardSubject(source: CopySource): string {
  return emailCopy(source).referralRewardSubject;
}

export function renderReferralRewardEmailHtml(
  recipientEmail: string,
  rewardCode: string,
  discountType: "percentage" | "fixed",
  discountValue: number,
  source: CopySource = {}
) {
  const c = emailCopy(source);
  const body = fill(c.referralRewardBody, { discount: escapeHtml(formatDiscountLabel(source, discountType, discountValue)) });
  return wrapEmailHtml(`
    <p ${P}>${c.hi}</p>
    <p ${P}>${body}</p>
    ${CODE}${escapeHtml(rewardCode)}</strong></p>
    ${signOffHtml(source)}
  `, buildUnsubscribeUrl(recipientEmail), source);
}

export function renderReferralRewardEmailText(
  recipientEmail: string,
  rewardCode: string,
  discountType: "percentage" | "fixed",
  discountValue: number,
  source: CopySource = {}
) {
  const c = emailCopy(source);
  const body = fill(c.referralRewardBody, { discount: formatDiscountLabel(source, discountType, discountValue) });
  return wrapEmailText([
    c.hi, "", body, "", `${c.promoCodeLabel}: ${rewardCode}`, "", c.thanks, c.team,
  ], buildUnsubscribeUrl(recipientEmail), source);
}

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
