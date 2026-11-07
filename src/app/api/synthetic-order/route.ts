import { NextRequest, NextResponse } from "next/server";
import { deleteSyntheticOrder, ensureOrdersTable, getOrderById } from "@/lib/db";
import { isUuid } from "@/lib/orderInput";
import { isSyntheticRequest, isSyntheticStatus } from "@/lib/syntheticOrder";

export const runtime = "nodejs";

/**
 * Lets the daily end-to-end checker read back, then delete, the synthetic
 * order it just placed. Answers 404 for any order that is not synthetic, so
 * the secret cannot be used to read or remove real orders.
 */

function notFound() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function GET(request: NextRequest) {
  if (!isSyntheticRequest(request)) return notFound();
  const orderId = request.nextUrl.searchParams.get("orderId");
  if (!isUuid(orderId)) return notFound();
  await ensureOrdersTable();
  const order = await getOrderById(orderId);
  if (!order || !isSyntheticStatus(order.status)) return notFound();
  return NextResponse.json({
    status: order.status,
    paymentIntentId: order.stripe_payment_intent_id ?? null,
  });
}

export async function DELETE(request: NextRequest) {
  if (!isSyntheticRequest(request)) return notFound();
  const orderId = request.nextUrl.searchParams.get("orderId");
  if (!isUuid(orderId)) return notFound();
  const status = await deleteSyntheticOrder(orderId);
  if (!status) return notFound();
  return NextResponse.json({ deleted: true, status });
}
