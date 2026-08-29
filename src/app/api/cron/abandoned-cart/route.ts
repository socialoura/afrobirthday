import { NextResponse } from "next/server";
import { ensureAutomatedEmailColumns, getAllOrders, getSetting } from "@/lib/db";
import { dedupeByEmail, getPaidEmails, getSuppressedEmails, isSuppressed } from "@/lib/emailOptOut";
import { sendAbandonedCartEmail } from "@/lib/abandonedCartEmail";
import { withCronRun } from "@/lib/cronRun";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return await withCronRun("abandoned-cart", async () => {
      const enabled = (await getSetting("abandoned_cart_email_enabled")) === "true";
      if (!enabled) {
        return NextResponse.json({ ok: true, skipped: "disabled" });
      }

      const delayHours = Number.parseInt(
        (await getSetting("abandoned_cart_email_delay_hours")) ?? "3",
        10
      );
      const cutoff = Date.now() - delayHours * 60 * 60 * 1000;

      // Without a floor, the first run after enabling this would mail every
      // unpaid order ever created — carts months old, to people who have long
      // since forgotten the site. That reads as spam and costs sender reputation.
      const maxAgeDays = Number.parseInt(
        (await getSetting("abandoned_cart_email_max_age_days")) ?? "7",
        10
      );
      const floor = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;

      await ensureAutomatedEmailColumns();
      const allOrders = await getAllOrders();
      const suppressed = await getSuppressedEmails(allOrders, "abandoned_cart_email_sent_at");
      const alreadyBought = getPaidEmails(allOrders);

      const eligible = allOrders.filter((o) => {
        if (!o.email) return false;
        if (isSuppressed(suppressed, o.email)) return false;
        // The abandoned order and the paid one are separate rows, so this has to
        // be checked per address rather than per order.
        if (isSuppressed(alreadyBought, o.email)) return false;
        if (o.status !== "pending") return false;
        if (o.abandoned_cart_email_sent_at) return false;
        const createdAt = new Date(o.created_at).getTime();
        return createdAt <= cutoff && createdAt >= floor;
    });

    const recipients = dedupeByEmail(eligible);

    let sent = 0;
    for (const order of recipients) {
      try {
        await sendAbandonedCartEmail(order);
        sent++;
      } catch (err) {
        console.error(`Abandoned cart email failed for order ${order.id}:`, err);
      }
    }

    return NextResponse.json({ ok: true, checked: allOrders.length, eligible: eligible.length, recipients: recipients.length, sent });
    });
  } catch (err) {
    console.error("Cron abandoned-cart error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
