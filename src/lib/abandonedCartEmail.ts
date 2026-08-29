import { type Order, markAbandonedCartEmailSent } from "@/lib/db";
import { sendEmailWithResend } from "@/lib/resend";
import { buildMarketingEmailHeaders } from "@/lib/emailOptOut";
import {
  renderAbandonedCartEmailHtml,
  renderAbandonedCartEmailText,
} from "@/lib/orderEmailTemplates";
import { SITE_URL } from "@/lib/siteUrl";

export async function sendAbandonedCartEmail(order: Order): Promise<void> {
  const siteUrl = SITE_URL;
  const resumeUrl = siteUrl.replace(/\/$/, "");

  await sendEmailWithResend({
    to: order.email,
    subject: "Complete your AfroBirthday order",
    html: renderAbandonedCartEmailHtml(order, resumeUrl),
    text: renderAbandonedCartEmailText(order, resumeUrl),
    replyTo: "support@afrobirthday.com",
    headers: buildMarketingEmailHeaders(order.email, order.id),
  });

  await markAbandonedCartEmailSent(order.id);
}
