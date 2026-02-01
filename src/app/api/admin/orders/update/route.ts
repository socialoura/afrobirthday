import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/auth";
import { updateOrderStatus, updateOrderNotes, updateOrderCost } from "@/lib/db";

export const runtime = "nodejs";

const VALID_STATUSES = ['pending', 'processing', 'completed', 'cancelled'];

export async function PUT(request: Request) {
  const admin = verifyAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { orderId, orderStatus, notes, cost } = await request.json();

    if (!orderId) {
      return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
    }

    if (orderStatus !== undefined) {
      if (!VALID_STATUSES.includes(orderStatus)) {
        return NextResponse.json({ error: "Invalid order status" }, { status: 400 });
      }
      await updateOrderStatus(orderId, orderStatus);
    }

    if (notes !== undefined) {
      await updateOrderNotes(orderId, notes);
    }

    if (cost !== undefined) {
      if (typeof cost !== 'number' || cost < 0) {
        return NextResponse.json({ error: "Invalid cost value" }, { status: 400 });
      }
      await updateOrderCost(orderId, cost);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update order error:", error);
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
  }
}
