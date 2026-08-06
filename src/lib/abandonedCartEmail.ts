import { type Order, markAbandonedCartEmailSent } from "@/lib/db";
import { sendEmailWithResend } from "@/lib/resend";
import {
  renderAbandonedCartEmailHtml,
  renderAbandonedCartEmailText,
} from "@/lib/orderEmailTemplates";

export async function sendAbandonedCartEmail(order: Order): Promise<void> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://afrobirthday.com";
  const resumeUrl = siteUrl.replace(/\/$/, "");

  await sendEmailWithResend({
    to: order.email,
    subject: "Complete your AfroBirthday order",
    html: renderAbandonedCartEmailHtml(order, resumeUrl),
    text: renderAbandonedCartEmailText(order, resumeUrl),
    replyTo: "support@afrobirthday.com",
    headers: {
      "List-Unsubscribe": "<mailto:support@afrobirthday.com?subject=unsubscribe>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      "X-Entity-Ref-ID": order.id,
    },
  });

  await markAbandonedCartEmailSent(order.id);
}
