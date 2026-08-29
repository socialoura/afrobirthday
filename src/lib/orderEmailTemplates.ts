import type { Order } from "@/lib/db";
import { buildUnsubscribeUrl } from "@/lib/emailOptOut";
import { EMAIL_CAMPAIGNS, withCampaign, type EmailCampaign } from "@/lib/campaign";

/**
 * Link back to the order form, tagged so the e-mail channel has a
 * denominator. Several of these messages handed out a promo code with no way
 * to spend it — the campaign was running with no destination at all.
 */
function orderLink(campaign: EmailCampaign) {
  return escapeHtml(withCampaign("/#order", campaign));
}

export function renderOrderConfirmationEmailHtml(order: Order) {
  const createdAt = order.created_at ? new Date(order.created_at).toLocaleString() : "";
  const delivery = order.delivery_method === "express" ? "Express (12-24 hours)" : "Standard (24-48 hours)";
  const music = order.music_option === "custom" ? "Custom song" : "We choose music";

  return `
    <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; line-height: 1.5; color: #111;">
      <h2 style="margin:0 0 12px;">Thanks for your order 🎂</h2>
      <p style="margin:0 0 16px;">We received your order and payment successfully.</p>

      <div style="border:1px solid #eee; border-radius:12px; padding:16px;">
        <h3 style="margin:0 0 12px;">Order details</h3>
        <p style="margin:0 0 6px;"><strong>Order ID:</strong> ${order.id}</p>
        ${createdAt ? `<p style="margin:0 0 6px;"><strong>Date:</strong> ${createdAt}</p>` : ""}
        <p style="margin:0 0 6px;"><strong>Total:</strong> ${formatOrderTotal(order)}</p>
        <p style="margin:0 0 6px;"><strong>Delivery:</strong> ${delivery}</p>
        <p style="margin:0 0 6px;"><strong>Music:</strong> ${music}</p>
        ${order.music_link ? `<p style="margin:0 0 6px;"><strong>Music link:</strong> ${escapeHtml(order.music_link)}</p>` : ""}
        ${order.dance_extended ? `<p style="margin:0 0 6px;"><strong>Dance extended version:</strong> Yes</p>` : ""}
        <p style="margin:12px 0 0;"><strong>Message:</strong><br/>${escapeHtml(order.message)}</p>
      </div>

      <p style="margin:16px 0 0;">
        We’ll deliver your video by email as soon as it’s ready.
      </p>

      <p style="margin:16px 0 0; font-size: 12px; color: #555;">
        Need help? Reply to this email.
      </p>
    </div>
  `;
}

export function renderFinalVideoEmailHtml(order: Order, videoUrl: string) {
  const safeUrl = escapeHtml(videoUrl);
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 16px;">
      <p style="margin:0 0 16px;">Hi,</p>

      <p style="margin:0 0 16px;">
        Your personalized birthday video is ready. You can view and download it from the link below.
      </p>

      <p style="margin: 0 0 16px;">
        <a href="${safeUrl}" style="color: #c2410c; text-decoration: underline; font-weight: 600;">
          View your video
        </a>
      </p>

      <p style="margin:0 0 16px; font-size: 14px; color:#555;">
        If the link above doesn't open, copy and paste this URL into your browser:<br/>
        <span style="word-break: break-all;">${safeUrl}</span>
      </p>

      <p style="margin:0 0 16px;">
        Your order reference is <strong>${order.id}</strong>. We'd love to hear what you think — just reply to this email if you have any feedback or questions.
      </p>

      <p style="margin:0 0 16px;">
        Thanks for choosing AfroBirthday,<br/>
        The AfroBirthday team
      </p>

      <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />

      <p style="margin:0; font-size: 12px; color: #888;">
        AfroBirthday — Personalized birthday videos<br/>
        Support: <a href="mailto:support@afrobirthday.com" style="color: #888;">support@afrobirthday.com</a><br/>
        You're receiving this email because you placed an order on afrobirthday.com.
      </p>
    </div>
  `;
}

export function renderFinalVideoEmailText(order: Order, videoUrl: string) {
  return [
    "Hi,",
    "",
    "Your personalized birthday video is ready. You can view and download it from the link below:",
    videoUrl,
    "",
    `Your order reference is ${order.id}. We'd love to hear what you think — just reply to this email if you have any feedback or questions.`,
    "",
    "Thanks for choosing AfroBirthday,",
    "The AfroBirthday team",
    "",
    "—",
    "AfroBirthday — Personalized birthday videos",
    "Support: support@afrobirthday.com",
    "You're receiving this email because you placed an order on afrobirthday.com.",
  ].join("\n");
}

export function renderOrderConfirmationEmailText(order: Order) {
  const delivery = order.delivery_method === "express" ? "Express (12-24 hours)" : "Standard (24-48 hours)";
  const music = order.music_option === "custom" ? "Custom song" : "We choose music";

  return [
    "Thanks for your order!",
    "",
    `Order ID: ${order.id}`,
    `Total: ${formatOrderTotal(order)}`,
    `Delivery: ${delivery}`,
    `Music: ${music}`,
    order.music_link ? `Music link: ${order.music_link}` : "",
    order.dance_extended ? "Dance extended version: Yes" : "",
    "",
    "Message:",
    order.message,
    "",
    "We’ll deliver your video by email as soon as it’s ready.",
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

/** Shared wrapper (font/width/footer) for the automated post-order emails below. */
function wrapEmailHtml(bodyHtml: string, unsubscribeUrl: string) {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 16px;">
      ${bodyHtml}

      <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />

      <p style="margin:0; font-size: 12px; color: #888;">
        AfroBirthday — Personalized birthday videos<br/>
        Support: <a href="mailto:support@afrobirthday.com" style="color: #888;">support@afrobirthday.com</a><br/>
        You're receiving this email because you placed an order on afrobirthday.com.<br/>
        <a href="${unsubscribeUrl}" style="color: #888; text-decoration: underline;">Unsubscribe from these emails</a>
      </p>
    </div>
  `;
}

function wrapEmailText(bodyLines: string[], unsubscribeUrl: string) {
  return [
    ...bodyLines,
    "",
    "—",
    "AfroBirthday — Personalized birthday videos",
    "Support: support@afrobirthday.com",
    "You're receiving this email because you placed an order on afrobirthday.com.",
    `Unsubscribe from these emails: ${unsubscribeUrl}`,
  ].join("\n");
}

function formatDiscountLabel(discountType: "percentage" | "fixed", discountValue: number) {
  return discountType === "percentage" ? `${discountValue}% off` : `$${discountValue} off`;
}

export function renderReviewRequestEmailHtml(order: Order) {
  const unsubscribeUrl = buildUnsubscribeUrl(order.email);
  return wrapEmailHtml(`
    <p style="margin:0 0 16px;">Hi,</p>
    <p style="margin:0 0 16px;">
      We hope you loved your personalized birthday video! If you have a minute,
      we'd really appreciate a quick review — it helps other people discover us.
    </p>
    <p style="margin:0 0 16px;">
      <a href="https://www.trustpilot.com/review/afrobirthday.com" style="color: #c2410c; text-decoration: underline; font-weight: 600;">
        Leave a review on Trustpilot
      </a>
    </p>
    <p style="margin:0 0 16px;">
      Thank you for your support,<br/>
      The AfroBirthday team
    </p>
  `, unsubscribeUrl);
}

export function renderReviewRequestEmailText(order: Order) {
  const unsubscribeUrl = buildUnsubscribeUrl(order.email);
  return wrapEmailText([
    "Hi,",
    "",
    "We hope you loved your personalized birthday video! If you have a minute, we'd really appreciate a quick review — it helps other people discover us.",
    "",
    "Leave a review on Trustpilot: https://www.trustpilot.com/review/afrobirthday.com",
    "",
    "Thank you for your support,",
    "The AfroBirthday team",
  ], unsubscribeUrl);
}

export function renderCrossSellEmailHtml(order: Order, promoCode: string) {
  const unsubscribeUrl = buildUnsubscribeUrl(order.email);
  return wrapEmailHtml(`
    <p style="margin:0 0 16px;">Hi,</p>
    <p style="margin:0 0 16px;">
      Got another birthday coming up? Surprise someone else with a personalized
      AfroBirthday video — use the code below for a discount on your next order.
    </p>
    <p style="margin:0 0 16px; font-size: 18px;">
      <strong style="letter-spacing: 1px;">${escapeHtml(promoCode)}</strong>
    </p>
    <p style="margin: 0 0 16px;">
      <a href="${orderLink(EMAIL_CAMPAIGNS.CROSS_SELL)}" style="color: #c2410c; text-decoration: underline; font-weight: 600;">
        Order another video
      </a>
    </p>
    <p style="margin:0 0 16px;">
      Thanks for being an AfroBirthday customer,<br/>
      The AfroBirthday team
    </p>
  `, unsubscribeUrl);
}

export function renderCrossSellEmailText(order: Order, promoCode: string) {
  const unsubscribeUrl = buildUnsubscribeUrl(order.email);
  return wrapEmailText([
    "Hi,",
    "",
    "Got another birthday coming up? Surprise someone else with a personalized AfroBirthday video — use the code below for a discount on your next order.",
    "",
    `Promo code: ${promoCode}`,
    "",
    `Order another video: ${withCampaign("/#order", EMAIL_CAMPAIGNS.CROSS_SELL)}`,
    "",
    "Thanks for being an AfroBirthday customer,",
    "The AfroBirthday team",
  ], unsubscribeUrl);
}

export function renderAnnualReminderEmailHtml(order: Order, promoCode: string) {
  const unsubscribeUrl = buildUnsubscribeUrl(order.email);
  return wrapEmailHtml(`
    <p style="margin:0 0 16px;">Hi,</p>
    <p style="margin:0 0 16px;">
      It's been a year since your last AfroBirthday video — same celebration
      again this year? Here's a code to make it easy.
    </p>
    <p style="margin:0 0 16px; font-size: 18px;">
      <strong style="letter-spacing: 1px;">${escapeHtml(promoCode)}</strong>
    </p>
    <p style="margin: 0 0 16px;">
      <a href="${orderLink(EMAIL_CAMPAIGNS.ANNUAL_REMINDER)}" style="color: #c2410c; text-decoration: underline; font-weight: 600;">
        Start your next video
      </a>
    </p>
    <p style="margin:0 0 16px;">
      Looking forward to making another one for you,<br/>
      The AfroBirthday team
    </p>
  `, unsubscribeUrl);
}

export function renderAnnualReminderEmailText(order: Order, promoCode: string) {
  const unsubscribeUrl = buildUnsubscribeUrl(order.email);
  return wrapEmailText([
    "Hi,",
    "",
    "It's been a year since your last AfroBirthday video — same celebration again this year? Here's a code to make it easy.",
    "",
    `Promo code: ${promoCode}`,
    "",
    `Start your next video: ${withCampaign("/#order", EMAIL_CAMPAIGNS.ANNUAL_REMINDER)}`,
    "",
    "Looking forward to making another one for you,",
    "The AfroBirthday team",
  ], unsubscribeUrl);
}

export function renderAbandonedCartEmailHtml(order: Order, resumeUrl: string) {
  const unsubscribeUrl = buildUnsubscribeUrl(order.email);
  const safeUrl = escapeHtml(resumeUrl);
  return wrapEmailHtml(`
    <p style="margin:0 0 16px;">Hi,</p>
    <p style="margin:0 0 16px;">
      Looks like you started a personalized birthday video but didn't finish
      checking out. Your details are saved — pick up right where you left off.
    </p>
    <p style="margin: 0 0 16px;">
      <a href="${safeUrl}" style="color: #c2410c; text-decoration: underline; font-weight: 600;">
        Finish your order
      </a>
    </p>
    <p style="margin:0 0 16px;">
      The AfroBirthday team
    </p>
  `, unsubscribeUrl);
}

export function renderAbandonedCartEmailText(order: Order, resumeUrl: string) {
  const unsubscribeUrl = buildUnsubscribeUrl(order.email);
  return wrapEmailText([
    "Hi,",
    "",
    "Looks like you started a personalized birthday video but didn't finish checking out. Your details are saved — pick up right where you left off:",
    resumeUrl,
    "",
    "The AfroBirthday team",
  ], unsubscribeUrl);
}

export function renderReferralCodeEmailHtml(
  order: Order,
  code: string,
  discountType: "percentage" | "fixed",
  discountValue: number
) {
  const unsubscribeUrl = buildUnsubscribeUrl(order.email);
  const discountLabel = formatDiscountLabel(discountType, discountValue);
  return wrapEmailHtml(`
    <p style="margin:0 0 16px;">Hi,</p>
    <p style="margin:0 0 16px;">
      Loved your AfroBirthday video? Share it with friends — here's your
      personal code for them to get ${escapeHtml(discountLabel)} on their first order.
      When they use it, we'll send you a reward too.
    </p>
    <p style="margin:0 0 16px; font-size: 18px;">
      <strong style="letter-spacing: 1px;">${escapeHtml(code)}</strong>
    </p>
    <p style="margin:0 0 16px;">
      Thanks for spreading the word,<br/>
      The AfroBirthday team
    </p>
  `, unsubscribeUrl);
}

export function renderReferralCodeEmailText(
  order: Order,
  code: string,
  discountType: "percentage" | "fixed",
  discountValue: number
) {
  const unsubscribeUrl = buildUnsubscribeUrl(order.email);
  const discountLabel = formatDiscountLabel(discountType, discountValue);
  return wrapEmailText([
    "Hi,",
    "",
    `Loved your AfroBirthday video? Share it with friends — here's your personal code for them to get ${discountLabel} on their first order. When they use it, we'll send you a reward too.`,
    "",
    `Your referral code: ${code}`,
    "",
    "Thanks for spreading the word,",
    "The AfroBirthday team",
  ], unsubscribeUrl);
}

export function renderReferralRewardEmailHtml(
  recipientEmail: string,
  rewardCode: string,
  discountType: "percentage" | "fixed",
  discountValue: number
) {
  const unsubscribeUrl = buildUnsubscribeUrl(recipientEmail);
  const discountLabel = formatDiscountLabel(discountType, discountValue);
  return wrapEmailHtml(`
    <p style="margin:0 0 16px;">Hi,</p>
    <p style="margin:0 0 16px;">
      Good news — a friend just used your referral code! As a thank you,
      here's a code for ${escapeHtml(discountLabel)} on your next AfroBirthday video.
    </p>
    <p style="margin:0 0 16px; font-size: 18px;">
      <strong style="letter-spacing: 1px;">${escapeHtml(rewardCode)}</strong>
    </p>
    <p style="margin:0 0 16px;">
      Thanks for spreading the word,<br/>
      The AfroBirthday team
    </p>
  `, unsubscribeUrl);
}

export function renderReferralRewardEmailText(
  recipientEmail: string,
  rewardCode: string,
  discountType: "percentage" | "fixed",
  discountValue: number
) {
  const unsubscribeUrl = buildUnsubscribeUrl(recipientEmail);
  const discountLabel = formatDiscountLabel(discountType, discountValue);
  return wrapEmailText([
    "Hi,",
    "",
    `Good news — a friend just used your referral code! As a thank you, here's a code for ${discountLabel} on your next AfroBirthday video.`,
    "",
    `Your reward code: ${rewardCode}`,
    "",
    "Thanks for spreading the word,",
    "The AfroBirthday team",
  ], unsubscribeUrl);
}

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
