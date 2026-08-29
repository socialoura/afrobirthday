import { type Order, markReviewEmailSent } from "@/lib/db";
import { sendEmailWithResend } from "@/lib/resend";
import { buildMarketingEmailHeaders } from "@/lib/emailOptOut";
import {
  renderReviewRequestEmailHtml,
  renderReviewRequestEmailText,
} from "@/lib/orderEmailTemplates";
import { trackEmailSent } from "@/lib/analyticsServer";
import { EMAIL_CAMPAIGNS } from "@/lib/campaign";

export async function sendReviewRequestEmail(order: Order): Promise<void> {
  await sendEmailWithResend({
    to: order.email,
    subject: "How was your AfroBirthday video?",
    html: renderReviewRequestEmailHtml(order),
    text: renderReviewRequestEmailText(order),
    replyTo: "support@afrobirthday.com",
    headers: buildMarketingEmailHeaders(order.email, order.id),
  });

  await trackEmailSent(EMAIL_CAMPAIGNS.REVIEW_REQUEST, order.email, { order_id: order.id });

  await markReviewEmailSent(order.id);
}
