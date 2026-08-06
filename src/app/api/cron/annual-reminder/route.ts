import { NextResponse } from "next/server";
import { getAllOrders, getSetting } from "@/lib/db";
import { sendAnnualReminderEmail } from "@/lib/annualReminderEmail";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const enabled = (await getSetting("annual_reminder_email_enabled")) === "true";
    if (!enabled) {
      return NextResponse.json({ ok: true, skipped: "disabled" });
    }

    const promoCode = await getSetting("winback_promo_code");
    if (!promoCode) {
      return NextResponse.json({ ok: true, skipped: "no winback_promo_code configured" });
    }

    const delayDays = Number.parseInt(
      (await getSetting("annual_reminder_email_delay_days")) ?? "365",
      10
    );
    const cutoff = Date.now() - delayDays * 24 * 60 * 60 * 1000;
    const allOrders = await getAllOrders();

    const eligible = allOrders.filter((o) => {
      if (!o.email) return false;
      if (o.status !== "paid") return false;
      if (o.annual_reminder_email_sent_at) return false;
      return new Date(o.created_at).getTime() <= cutoff;
    });

    let sent = 0;
    for (const order of eligible) {
      try {
        await sendAnnualReminderEmail(order, promoCode);
        sent++;
      } catch (err) {
        console.error(`Annual reminder email failed for order ${order.id}:`, err);
      }
    }

    return NextResponse.json({ ok: true, checked: allOrders.length, eligible: eligible.length, sent });
  } catch (err) {
    console.error("Cron annual-reminder error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
