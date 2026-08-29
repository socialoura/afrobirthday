import { NextResponse } from "next/server";
import { getAllOrders } from "@/lib/db";
import { getOverdueOrders, sendOverdueAlerts } from "@/lib/telegramBot";
import { withCronRun } from "@/lib/cronRun";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return await withCronRun("check-overdue", async () => {
      const allOrders = await getAllOrders();
      const overdue = getOverdueOrders(allOrders);

      if (overdue.length > 0) {
        await sendOverdueAlerts(overdue);
      }

      return NextResponse.json({
        ok: true,
        checked: allOrders.length,
        overdue: overdue.length,
    });
    });
  } catch (err) {
    console.error("Cron check-overdue error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
