import { NextResponse } from "next/server";
import { getOrderById } from "@/lib/db";
import { isUuid } from "@/lib/orderInput";

export const runtime = "nodejs";

/**
 * What the success page needs to report a purchase: the amount and currency
 * actually charged, read from the order instead of trusted from the URL.
 * Returns nothing personal; the order id is an unguessable UUID.
 */
export async function GET(request: Request) {
  const orderId = new URL(request.url).searchParams.get("orderId");
  if (!isUuid(orderId)) {
    return NextResponse.json({ error: "Invalid orderId" }, { status: 400 });
  }

  try {
    const order = await getOrderById(orderId);
    if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(
      {
        status: order.status,
        value: Number(order.total_local ?? order.total_usd),
        currency: (order.currency || "USD").toUpperCase(),
        valueUsd: Math.max(0, Number(order.total_usd) - Number(order.discount_amount || 0)),
        deliveryMethod: order.delivery_method,
        createdAt: order.created_at,
        locale: order.locale,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("order-summary error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
