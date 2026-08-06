import { type Order, markCrossSellEmailSent } from "@/lib/db";
import { sendEmailWithResend } from "@/lib/resend";
import {
  renderCrossSellEmailHtml,
  renderCrossSellEmailText,
} from "@/lib/orderEmailTemplates";

export async function sendCrossSellEmail(order: Order, promoCode: string): Promise<void> {
  await sendEmailWithResend({
    to: order.email,
    subject: "Another birthday coming up?",
    html: renderCrossSellEmailHtml(order, promoCode),
    text: renderCrossSellEmailText(order, promoCode),
    replyTo: "support@afrobirthday.com",
    headers: {
      "List-Unsubscribe": "<mailto:support@afrobirthday.com?subject=unsubscribe>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      "X-Entity-Ref-ID": order.id,
    },
  });

  await markCrossSellEmailSent(order.id);
}
