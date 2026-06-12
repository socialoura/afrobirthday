import {
  type Order,
  markFinalVideoSent,
  updateOrderFinalVideoUrl,
} from "@/lib/db";
import { sendEmailWithResend } from "@/lib/resend";
import {
  renderFinalVideoEmailHtml,
  renderFinalVideoEmailText,
} from "@/lib/orderEmailTemplates";

/**
 * Persists the final video URL (if changed), emails the customer their delivery
 * link, and marks the order as sent. Shared by the admin dashboard route and
 * the magic-link mobile upload flow so both stay in sync.
 *
 * @throws if no final video URL is available for the order.
 */
export async function deliverFinalVideoEmail(
  order: Order,
  videoUrl?: string | null
): Promise<void> {
  const finalUrl =
    typeof videoUrl === "string" && videoUrl.length > 0
      ? videoUrl
      : order.final_video_url;

  if (!finalUrl) {
    throw new Error("No final video URL available for this order");
  }

  if (finalUrl !== order.final_video_url) {
    await updateOrderFinalVideoUrl(order.id, finalUrl);
  }

  const shortRef = order.id.slice(0, 8);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://afrobirthday.com";
  const emailVideoUrl = `${siteUrl.replace(/\/$/, "")}/v/${order.id}`;

  await sendEmailWithResend({
    to: order.email,
    subject: `Your AfroBirthday video is ready — order ${shortRef}`,
    html: renderFinalVideoEmailHtml(order, emailVideoUrl),
    text: renderFinalVideoEmailText(order, emailVideoUrl),
    replyTo: "support@afrobirthday.com",
    headers: {
      "List-Unsubscribe": "<mailto:support@afrobirthday.com?subject=unsubscribe>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      "X-Entity-Ref-ID": order.id,
    },
  });

  await markFinalVideoSent(order.id);
}
