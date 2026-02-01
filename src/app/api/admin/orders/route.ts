import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/auth";
import { getAllOrders, initAdminTables } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const admin = verifyAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await initAdminTables();
    const orders = await getAllOrders();
    return NextResponse.json({ orders });
  } catch (error) {
    console.error("Get orders error:", error);
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}
