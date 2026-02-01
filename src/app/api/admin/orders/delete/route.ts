import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/auth";
import { deleteOrder } from "@/lib/db";

export const runtime = "nodejs";

export async function DELETE(request: Request) {
  const admin = verifyAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('id');

    if (!orderId) {
      return NextResponse.json({ error: "Missing order ID" }, { status: 400 });
    }

    await deleteOrder(orderId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete order error:", error);
    return NextResponse.json({ error: "Failed to delete order" }, { status: 500 });
  }
}
