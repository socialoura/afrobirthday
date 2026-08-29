import { type Order, markAbandonedCartEmailSent } from "@/lib/db";
import { sendEmailWithResend } from "@/lib/resend";
import { buildMarketingEmailHeaders } from "@/lib/emailOptOut";
import {
  renderAbandonedCartEmailHtml,
  renderAbandonedCartEmailText,
} from "@/lib/orderEmailTemplates";
import { EMAIL_CAMPAIGNS, withCampaign } from "@/lib/campaign";
import { trackEmailSent } from "@/lib/analyticsServer";

export async function sendAbandonedCartEmail(order: Order): Promise<void> {
  const resumeUrl = withCampaign("/#order", EMAIL_CAMPAIGNS.ABANDONED_CART);

  await sendEmailWithResend({
    to: order.email,
    subject: "Complete your AfroBirthday order",
    html: renderAbandonedCartEmailHtml(order, resumeUrl),
    text: renderAbandonedCartEmailText(order, resumeUrl),
    replyTo: "support@afrobirthday.com",
    headers: buildMarketingEmailHeaders(order.email, order.id),
  });

  await trackEmailSent(EMAIL_CAMPAIGNS.ABANDONED_CART, order.email, { order_id: order.id });

  await markAbandonedCartEmailSent(order.id);
}
