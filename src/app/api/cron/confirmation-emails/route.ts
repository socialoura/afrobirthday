import { NextResponse } from "next/server";
import { rejectUnauthorizedCron } from "@/lib/cronAuth";
import { getPaidOrdersMissingConfirmationEmail } from "@/lib/db";
import { sendOrderConfirmationEmail } from "@/lib/orderFulfillment";
import { withCronRun } from "@/lib/cronRun";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Retries order confirmation emails that failed at payment time. The paid
 * claim happens before the email, so without this a Resend outage meant the
 * customer never heard from us. Schedule from the VPS crontab every ~15 min.
 */
export async function GET(request: Request) {
  const unauthorized = rejectUnauthorizedCron(request, "confirmation-emails");
  if (unauthorized) return unauthorized;

  try {
    return await withCronRun("confirmation-emails", async () => {
      const orders = await getPaidOrdersMissingConfirmationEmail();
      let sent = 0;
      for (const order of orders) {
        if (await sendOrderConfirmationEmail(order)) sent++;
      }
      return NextResponse.json({ ok: true, pending: orders.length, sent });
    });
  } catch (err) {
    console.error("Cron confirmation-emails error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
