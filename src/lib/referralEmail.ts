import { randomBytes } from "node:crypto";
import {
  type Order,
  createPromoCode,
  getPromoCodeByCode,
  getLatestOrderLocaleByEmail,
  getSetting,
  isEmailOptedOut,
  markReferralEmailSent,
  normalizeEmail,
  recordPromoCodeRedemption,
} from "@/lib/db";
import { sendEmailWithResend } from "@/lib/resend";
import { buildMarketingEmailHeaders } from "@/lib/emailOptOut";
import { trackEmailSent } from "@/lib/analyticsServer";
import { EMAIL_CAMPAIGNS } from "@/lib/campaign";
import {
  referralCodeSubject,
  referralRewardSubject,
  renderReferralCodeEmailHtml,
  renderReferralCodeEmailText,
  renderReferralRewardEmailHtml,
  renderReferralRewardEmailText,
} from "@/lib/orderEmailTemplates";

// Unambiguous alphabet (no 0/O/1/I); crypto-random so codes can't be predicted.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCodeSuffix() {
  return Array.from(randomBytes(8), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

/**
 * Generates a personal referral code for a customer (owner_email set) and
 * emails it to them. Called by the referral-code cron a few days after
 * delivery.
 */
export async function generateAndSendReferralCode(
  order: Order,
  discountType: "percentage" | "fixed",
  discountValue: number,
  maxUses: number
): Promise<void> {
  const code = `FRIEND-${randomCodeSuffix()}`;

  await createPromoCode({
    code,
    discountType,
    discountValue,
    maxUses,
    ownerEmail: order.email,
  });

  await sendEmailWithResend({
    to: order.email,
    subject: referralCodeSubject(order),
    html: renderReferralCodeEmailHtml(order, code, discountType, discountValue),
    text: renderReferralCodeEmailText(order, code, discountType, discountValue),
    replyTo: "support@afrobirthday.com",
    headers: buildMarketingEmailHeaders(order.email, order.id),
  });

  await trackEmailSent(EMAIL_CAMPAIGNS.REFERRAL_CODE, order.email, { order_id: order.id });

  await markReferralEmailSent(order.id);
}

/**
 * Called right after a promo code redemption is confirmed (payment
 * webhook/confirm-payment/PayPal capture). If the redeemed code was a
 * referral code (has an owner_email), logs the redemption and rewards the
 * referrer with a fresh single-use code.
 */
export async function handlePossibleReferralRedemption(redeemedOrder: Order): Promise<void> {
  const code = redeemedOrder.promo_code;
  if (!code) return;

  const promoCode = await getPromoCodeByCode(code);
  if (!promoCode?.owner_email) return;
  // Using your own referral code is a discount, not a referral: no reward.
  if (normalizeEmail(promoCode.owner_email) === normalizeEmail(redeemedOrder.email)) return;

  await recordPromoCodeRedemption({
    code: promoCode.code,
    orderId: redeemedOrder.id,
    referredEmail: redeemedOrder.email,
  });

  // The redemption still counts, but a referrer who opted out of marketing
  // doesn't get a reward email — and a reward code they never see is useless.
  if (await isEmailOptedOut(promoCode.owner_email)) return;

  const rewardType =
    ((await getSetting("referral_reward_type")) as "percentage" | "fixed") ?? "percentage";
  const rewardValue = Number.parseFloat((await getSetting("referral_reward_value")) ?? "15");
  const rewardCode = `THANKS-${randomCodeSuffix()}`;

  const copySource = { locale: await getLatestOrderLocaleByEmail(promoCode.owner_email).catch(() => null) };

  await createPromoCode({
    code: rewardCode,
    discountType: rewardType,
    discountValue: rewardValue,
    maxUses: 1,
  });

  await sendEmailWithResend({
    to: promoCode.owner_email,
    subject: referralRewardSubject(copySource),
    html: renderReferralRewardEmailHtml(promoCode.owner_email, rewardCode, rewardType, rewardValue, copySource),
    text: renderReferralRewardEmailText(promoCode.owner_email, rewardCode, rewardType, rewardValue, copySource),
    replyTo: "support@afrobirthday.com",
    headers: buildMarketingEmailHeaders(promoCode.owner_email),
  });

  await trackEmailSent(EMAIL_CAMPAIGNS.REFERRAL_REWARD, promoCode.owner_email);
}
