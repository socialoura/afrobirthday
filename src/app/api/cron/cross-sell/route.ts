import { NextResponse } from "next/server";
import { ensureAutomatedEmailColumns, getAllOrders, getSetting } from "@/lib/db";
import { dedupeByEmail, getSuppressedEmails, isSuppressed } from "@/lib/emailOptOut";
import { sendCrossSellEmail } from "@/lib/crossSellEmail";
import { withCronRun } from "@/lib/cronRun";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return await withCronRun("cross-sell", async () => {
      const enabled = (await getSetting("cross_sell_email_enabled")) === "true";
      if (!enabled) {
        return NextResponse.json({ ok: true, skipped: "disabled" });
      }

      const promoCode = await getSetting("winback_promo_code");
      if (!promoCode) {
        return NextResponse.json({ ok: true, skipped: "no winback_promo_code configured" });
      }

      const delayDays = Number.parseInt(
        (await getSetting("cross_sell_email_delay_days")) ?? "7",
        10
      );
      const cutoff = Date.now() - delayDays * 24 * 60 * 60 * 1000;
      await ensureAutomatedEmailColumns();
      const allOrders = await getAllOrders();
      const suppressed = await getSuppressedEmails(allOrders, "cross_sell_email_sent_at");

      const eligible = allOrders.filter((o) => {
        if (!o.email) return false;
        if (isSuppressed(suppressed, o.email)) return false;
        if (o.cross_sell_email_sent_at) return false;
        if (o.order_status !== "completed") return false;
        if (!o.final_video_sent_at) return false;
        return new Date(o.final_video_sent_at).getTime() <= cutoff;
    });

    const recipients = dedupeByEmail(eligible);

    let sent = 0;
    for (const order of recipients) {
      try {
        await sendCrossSellEmail(order, promoCode);
        sent++;
      } catch (err) {
        console.error(`Cross-sell email failed for order ${order.id}:`, err);
      }
    }

    return NextResponse.json({ ok: true, checked: allOrders.length, eligible: eligible.length, recipients: recipients.length, sent });
    });
  } catch (err) {
    console.error("Cron cross-sell error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
