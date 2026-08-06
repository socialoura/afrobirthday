import { NextResponse } from "next/server";
import { getAllOrders, getSetting } from "@/lib/db";
import { sendAbandonedCartEmail } from "@/lib/abandonedCartEmail";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const enabled = (await getSetting("abandoned_cart_email_enabled")) === "true";
    if (!enabled) {
      return NextResponse.json({ ok: true, skipped: "disabled" });
    }

    const delayHours = Number.parseInt(
      (await getSetting("abandoned_cart_email_delay_hours")) ?? "3",
      10
    );
    const cutoff = Date.now() - delayHours * 60 * 60 * 1000;
    const allOrders = await getAllOrders();

    const eligible = allOrders.filter((o) => {
      if (!o.email) return false;
      if (o.status !== "pending") return false;
      if (o.abandoned_cart_email_sent_at) return false;
      return new Date(o.created_at).getTime() <= cutoff;
    });

    let sent = 0;
    for (const order of eligible) {
      try {
        await sendAbandonedCartEmail(order);
        sent++;
      } catch (err) {
        console.error(`Abandoned cart email failed for order ${order.id}:`, err);
      }
    }

    return NextResponse.json({ ok: true, checked: allOrders.length, eligible: eligible.length, sent });
  } catch (err) {
    console.error("Cron abandoned-cart error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
