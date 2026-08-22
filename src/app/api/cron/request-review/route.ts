import { NextResponse } from "next/server";
import { ensureAutomatedEmailColumns, getAllOrders, getSetting } from "@/lib/db";
import { dedupeByEmail, getSuppressedEmails, isSuppressed } from "@/lib/emailOptOut";
import { sendReviewRequestEmail } from "@/lib/reviewRequestEmail";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const enabled = (await getSetting("review_email_enabled")) !== "false";
    if (!enabled) {
      return NextResponse.json({ ok: true, skipped: "disabled" });
    }

    const delayDays = Number.parseInt((await getSetting("review_email_delay_days")) ?? "3", 10);
    const cutoff = Date.now() - delayDays * 24 * 60 * 60 * 1000;
    await ensureAutomatedEmailColumns();
    const allOrders = await getAllOrders();
    const suppressed = await getSuppressedEmails(allOrders, "review_email_sent_at");

    const eligible = allOrders.filter((o) => {
      if (!o.email) return false;
      if (isSuppressed(suppressed, o.email)) return false;
      if (o.review_email_sent_at) return false;
      if (o.order_status !== "completed") return false;
      if (!o.final_video_sent_at) return false;
      return new Date(o.final_video_sent_at).getTime() <= cutoff;
    });

    const recipients = dedupeByEmail(eligible);

    let sent = 0;
    for (const order of recipients) {
      try {
        await sendReviewRequestEmail(order);
        sent++;
      } catch (err) {
        console.error(`Review email failed for order ${order.id}:`, err);
      }
    }

    return NextResponse.json({ ok: true, checked: allOrders.length, eligible: eligible.length, recipients: recipients.length, sent });
  } catch (err) {
    console.error("Cron request-review error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
