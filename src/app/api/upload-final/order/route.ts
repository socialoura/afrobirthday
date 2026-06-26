import { NextResponse } from "next/server";
import { verifyUploadToken } from "@/lib/auth";
import { getOrderById } from "@/lib/db";

export const runtime = "nodejs";

// Returns the minimal order details needed by the magic-link mobile upload
// page. Authorized by an order-scoped upload token whose orderId must match the
// requested order — no admin session required.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("orderId") ?? "";
  const token = searchParams.get("t") ?? "";

  const upload = verifyUploadToken(token);
  if (!upload || upload.orderId !== orderId) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });
  }

  try {
    const order = await getOrderById(orderId);
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({
      order: {
        id: order.id,
        email: order.email,
        message: order.message,
        photo_url: order.photo_url,
        music_option: order.music_option,
        music_link: order.music_link,
        music_file_url: order.music_file_url,
        delivery_method: order.delivery_method,
        created_at: order.created_at,
        final_video_url: order.final_video_url,
        final_video_sent_at: order.final_video_sent_at,
        voiceover_url: order.voiceover_url,
        downloaded_music_url: order.downloaded_music_url,
      },
    });
  } catch (error) {
    console.error("Upload-final order fetch error:", error);
    return NextResponse.json({ error: "Failed to load order" }, { status: 500 });
  }
}
