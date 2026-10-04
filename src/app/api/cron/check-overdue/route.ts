import { NextResponse } from "next/server";
import { rejectUnauthorizedCron } from "@/lib/cronAuth";
import { claimOverdueAlertLevel, getUndeliveredPaidOrders } from "@/lib/db";
import { deadlineLevel, getOverdueOrders, sendDeadlineAlert, sendOverdueAlerts } from "@/lib/telegramBot";
import { withCronRun } from "@/lib/cronRun";

export const runtime = "nodejs";

/**
 * Hourly (VPS crontab). Each undelivered paid order triggers one Telegram
 * alert when it becomes "due soon" and one when it turns late; the full list
 * of late orders is still summarised once a day at 09:00 UTC.
 */
export async function GET(request: Request) {
  const unauthorized = rejectUnauthorizedCron(request, "check-overdue");
  if (unauthorized) return unauthorized;

  try {
    return await withCronRun("check-overdue", async () => {
      const queue = await getUndeliveredPaidOrders();
      let alerted = 0;

      for (const order of queue) {
        const level = deadlineLevel(order);
        if (level === 0) continue;
        // Claim first so a concurrent run cannot send the same alert twice.
        if (await claimOverdueAlertLevel(order.id, level)) {
          await sendDeadlineAlert(order, level);
          alerted++;
        }
      }

      const overdue = getOverdueOrders(queue);
      if (overdue.length > 0 && new Date().getUTCHours() === 9) {
        await sendOverdueAlerts(overdue);
      }

      return NextResponse.json({
        ok: true,
        queue: queue.length,
        overdue: overdue.length,
        alerted,
      });
    });
  } catch (err) {
    console.error("Cron check-overdue error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
