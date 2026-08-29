import { type Order, markAnnualReminderEmailSent } from "@/lib/db";
import { sendEmailWithResend } from "@/lib/resend";
import { buildMarketingEmailHeaders } from "@/lib/emailOptOut";
import {
  renderAnnualReminderEmailHtml,
  renderAnnualReminderEmailText,
} from "@/lib/orderEmailTemplates";
import { trackEmailSent } from "@/lib/analyticsServer";
import { EMAIL_CAMPAIGNS } from "@/lib/campaign";

export async function sendAnnualReminderEmail(order: Order, promoCode: string): Promise<void> {
  await sendEmailWithResend({
    to: order.email,
    subject: "Same celebration this year?",
    html: renderAnnualReminderEmailHtml(order, promoCode),
    text: renderAnnualReminderEmailText(order, promoCode),
    replyTo: "support@afrobirthday.com",
    headers: buildMarketingEmailHeaders(order.email, order.id),
  });

  await trackEmailSent(EMAIL_CAMPAIGNS.ANNUAL_REMINDER, order.email, { order_id: order.id });

  await markAnnualReminderEmailSent(order.id);
}
