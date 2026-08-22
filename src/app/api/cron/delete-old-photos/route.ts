import { NextResponse } from "next/server";
import { getAllOrders, clearOrderPhoto } from "@/lib/db";
import { keyFromPublicUrl, deleteObject } from "@/lib/storage";

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
    // Photos uploaded before the move to Supabase Storage still live on Vercel
    // Blob, whose URLs keyFromPublicUrl can't map to a bucket key. Clearing
    // photo_url for those would erase the only pointer to a file we never
    // deleted: the photo would stay publicly readable forever, unfindable, and
    // the 30-day retention promise would be silently broken. So skip them —
    // better a row that keeps retrying than an orphaned photo.
    let unmapped = 0;
    for (const order of eligible) {
      try {
        const key = keyFromPublicUrl(order.photo_url!);
        if (!key) {
          unmapped++;
          continue;
        }
        await deleteObject(key);
        await clearOrderPhoto(order.id);
        deleted++;
      } catch (err) {
        console.error(`Photo cleanup failed for order ${order.id}:`, err);
      }
    }

    if (unmapped > 0) {
      console.warn(`Photo cleanup: ${unmapped} order(s) hold a photo URL this cron cannot delete (legacy Vercel Blob storage) — left untouched.`);
    }

    return NextResponse.json({ ok: true, checked: allOrders.length, eligible: eligible.length, deleted, unmapped });
  } catch (err) {
    console.error("Cron delete-old-photos error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
