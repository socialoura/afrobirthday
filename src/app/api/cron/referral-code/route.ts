import { NextResponse } from "next/server";
import { rejectUnauthorizedCron } from "@/lib/cronAuth";
import { ensureAutomatedEmailColumns, getAllOrders, getSetting } from "@/lib/db";
import { dedupeByEmail, getSuppressedEmails, isSuppressed } from "@/lib/emailOptOut";
import { generateAndSendReferralCode } from "@/lib/referralEmail";
import { withCronRun } from "@/lib/cronRun";

export async function GET(request: Request) {
  const unauthorized = rejectUnauthorizedCron(request, "referral-code");
  if (unauthorized) return unauthorized;

  try {
    return await withCronRun("referral-code", async () => {
      const enabled = (await getSetting("referral_email_enabled")) === "true";
      if (!enabled) {
        return NextResponse.json({ ok: true, skipped: "disabled" });
      }

      const delayDays = Number.parseInt(
        (await getSetting("referral_email_delay_days")) ?? "3",
        10
      );
      const cutoff = Date.now() - delayDays * 24 * 60 * 60 * 1000;
      // New customers only (see cross-sell): 14-day window after the delay.
      const windowDays = Number.parseInt((await getSetting("referral_email_window_days")) ?? "14", 10);
      const oldest = cutoff - windowDays * 24 * 60 * 60 * 1000;
      await ensureAutomatedEmailColumns();
      const allOrders = await getAllOrders();
      const suppressed = await getSuppressedEmails(allOrders, "referral_email_sent_at");

      const eligible = allOrders.filter((o) => {
        if (!o.email) return false;
        if (isSuppressed(suppressed, o.email)) return false;
        if (o.referral_email_sent_at) return false;
        if (o.order_status !== "completed") return false;
        if (!o.final_video_sent_at) return false;
        // Videos hosted on the defunct Supabase store can no longer be opened;
        // inviting those customers to order again would point at a dead link.
        if (o.final_video_url?.includes("supabase.co")) return false;
        const deliveredAt = new Date(o.final_video_sent_at).getTime();
        return deliveredAt <= cutoff && deliveredAt >= oldest;
    });

    const discountType =
      ((await getSetting("referral_friend_discount_type")) as "percentage" | "fixed") ??
      "percentage";
    const discountValue = Number.parseFloat(
      (await getSetting("referral_friend_discount_value")) ?? "15"
    );
    const maxUses = Number.parseInt((await getSetting("referral_max_uses")) ?? "5", 10);

    const recipients = dedupeByEmail(eligible);

    let sent = 0;
    for (const order of recipients) {
      try {
        await generateAndSendReferralCode(order, discountType, discountValue, maxUses);
        sent++;
      } catch (err) {
        console.error(`Referral code email failed for order ${order.id}:`, err);
      }
    }

    return NextResponse.json({ ok: true, checked: allOrders.length, eligible: eligible.length, recipients: recipients.length, sent });
    });
  } catch (err) {
    console.error("Cron referral-code error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
