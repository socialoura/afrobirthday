import { type Order, markReviewEmailSent } from "@/lib/db";
import { sendEmailWithResend } from "@/lib/resend";
import {
  renderReviewRequestEmailHtml,
  renderReviewRequestEmailText,
} from "@/lib/orderEmailTemplates";

export async function sendReviewRequestEmail(order: Order): Promise<void> {
  await sendEmailWithResend({
    to: order.email,
    subject: "How was your AfroBirthday video?",
    html: renderReviewRequestEmailHtml(order),
    text: renderReviewRequestEmailText(order),
    replyTo: "support@afrobirthday.com",
    headers: {
      "List-Unsubscribe": "<mailto:support@afrobirthday.com?subject=unsubscribe>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      "X-Entity-Ref-ID": order.id,
    },
  });

  await markReviewEmailSent(order.id);
}
