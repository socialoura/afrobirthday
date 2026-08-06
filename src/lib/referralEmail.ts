import {
  type Order,
  createPromoCode,
  getPromoCodeByCode,
  getSetting,
  markReferralEmailSent,
  recordPromoCodeRedemption,
} from "@/lib/db";
import { sendEmailWithResend } from "@/lib/resend";
import {
  renderReferralCodeEmailHtml,
  renderReferralCodeEmailText,
  renderReferralRewardEmailHtml,
  renderReferralRewardEmailText,
} from "@/lib/orderEmailTemplates";

function randomCodeSuffix() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
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
    subject: "Share the surprise, get rewarded",
    html: renderReferralCodeEmailHtml(order, code, discountType, discountValue),
    text: renderReferralCodeEmailText(order, code, discountType, discountValue),
    replyTo: "support@afrobirthday.com",
    headers: {
      "List-Unsubscribe": "<mailto:support@afrobirthday.com?subject=unsubscribe>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      "X-Entity-Ref-ID": order.id,
    },
  });

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

  await recordPromoCodeRedemption({
    code: promoCode.code,
    orderId: redeemedOrder.id,
    referredEmail: redeemedOrder.email,
  });

  const rewardType =
    ((await getSetting("referral_reward_type")) as "percentage" | "fixed") ?? "percentage";
  const rewardValue = Number.parseFloat((await getSetting("referral_reward_value")) ?? "15");
  const rewardCode = `THANKS-${randomCodeSuffix()}`;

  await createPromoCode({
    code: rewardCode,
    discountType: rewardType,
    discountValue: rewardValue,
    maxUses: 1,
  });

  await sendEmailWithResend({
    to: promoCode.owner_email,
    subject: "A friend used your referral code!",
    html: renderReferralRewardEmailHtml(rewardCode, rewardType, rewardValue),
    text: renderReferralRewardEmailText(rewardCode, rewardType, rewardValue),
    replyTo: "support@afrobirthday.com",
    headers: {
      "List-Unsubscribe": "<mailto:support@afrobirthday.com?subject=unsubscribe>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });
}
