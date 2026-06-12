import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/auth";
import { getOrderById } from "@/lib/db";
import { deliverFinalVideoEmail } from "@/lib/finalVideoEmail";

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

    await deliverFinalVideoEmail(order, videoUrl);

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
