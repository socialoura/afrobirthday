import { NextResponse } from "next/server";
import { verifyUploadToken } from "@/lib/auth";
import { getOrderById, updateOrderFinalVideoUrl } from "@/lib/db";
import { deliverFinalVideoEmail } from "@/lib/finalVideoEmail";

export const runtime = "nodejs";

// Saves the uploaded final video URL for an order and, when requested, emails
// the customer their delivery link. Authorized by an order-scoped upload token
// (magic link) — never grants access beyond its own order.
export async function POST(request: Request) {
  try {
    const { orderId, t, videoUrl, sendEmail } = (await request.json()) as {
      orderId?: string;
      t?: string;
      videoUrl?: string;
      sendEmail?: boolean;
    };

    const upload = t ? verifyUploadToken(t) : null;
    if (!upload || !orderId || upload.orderId !== orderId) {
      return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });
    }

    if (typeof videoUrl !== "string" || !videoUrl) {
      return NextResponse.json({ error: "Missing videoUrl" }, { status: 400 });
    }

    const order = await getOrderById(orderId);
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (sendEmail) {
      // Persists the URL (if changed), emails the customer, and marks as sent.
      await deliverFinalVideoEmail(order, videoUrl);
    } else {
      await updateOrderFinalVideoUrl(orderId, videoUrl);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Upload-final save error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save" },
      { status: 500 }
    );
  }
}
