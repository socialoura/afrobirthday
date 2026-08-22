import { NextResponse } from "next/server";
import { getAllOrders, clearOrderPhoto } from "@/lib/db";
import { deletePhotoByUrl } from "@/lib/storage";

export const runtime = "nodejs";

const RETENTION_DAYS = 30;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const allOrders = await getAllOrders();

    const eligible = allOrders.filter((o) => {
      if (!o.photo_url) return false;
      if (o.order_status !== "completed") return false;
      if (!o.final_video_sent_at) return false;
      return new Date(o.final_video_sent_at).getTime() <= cutoff;
    });

    let deleted = 0;
    // Never clear photo_url for a URL we couldn't delete: that would erase the
    // only pointer to a file left publicly readable, and silently break the
    // 30-day retention promise. Better a row that keeps retrying.
    let unmapped = 0;
    for (const order of eligible) {
      try {
        if (!(await deletePhotoByUrl(order.photo_url!))) {
          unmapped++;
          continue;
        }
        await clearOrderPhoto(order.id);
        deleted++;
      } catch (err) {
        console.error(`Photo cleanup failed for order ${order.id}:`, err);
      }
    }

    if (unmapped > 0) {
      console.warn(`Photo cleanup: ${unmapped} order(s) hold a photo URL this cron cannot delete (unrecognized storage URL) — left untouched.`);
    }

    return NextResponse.json({ ok: true, checked: allOrders.length, eligible: eligible.length, deleted, unmapped });
  } catch (err) {
    console.error("Cron delete-old-photos error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
