import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/auth";
import {
  getOrderById,
  markFinalVideoSent,
  updateOrderFinalVideoUrl,
} from "@/lib/db";
import { sendEmailWithResend } from "@/lib/resend";
import {
  renderFinalVideoEmailHtml,
  renderFinalVideoEmailText,
} from "@/lib/orderEmailTemplates";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const admin = verifyAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { orderId, videoUrl } = await request.json();

    if (!orderId || typeof orderId !== "string") {
      return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
    }

    const order = await getOrderById(orderId);
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Prefer the explicit videoUrl from the request, fall back to stored value.
    const finalUrl =
      typeof videoUrl === "string" && videoUrl.length > 0
        ? videoUrl
        : order.final_video_url;

    if (!finalUrl) {
      return NextResponse.json(
        { error: "No final video URL available for this order" },
        { status: 400 }
      );
    }

    // Persist the URL if it was provided/changed.
    if (finalUrl !== order.final_video_url) {
      await updateOrderFinalVideoUrl(orderId, finalUrl);
    }

    await sendEmailWithResend({
      to: order.email,
      subject: "Your AfroBirthday video is ready 🎉",
      html: renderFinalVideoEmailHtml(order, finalUrl),
      text: renderFinalVideoEmailText(order, finalUrl),
    });

    await markFinalVideoSent(orderId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Send final email error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to send final email",
      },
      { status: 500 }
    );
  }
}
