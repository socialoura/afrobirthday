import { NextRequest, NextResponse } from "next/server";
import { ensureOrdersTable } from "@/lib/db";
import { fulfillPayPalOrder } from "@/lib/orderFulfillment";
import { sendTelegramMessage } from "@/lib/telegramBot";

export const runtime = "nodejs";
// notifyOrderPaid generates the TTS voiceover and downloads the custom song,
// which can exceed the default 10s budget. 60s is the Hobby plan ceiling.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, paypalOrderId } = body as {
      orderId?: string;
      paypalOrderId?: string;
    };

    if (!orderId || typeof orderId !== "string") {
      return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
    }
    if (!paypalOrderId || typeof paypalOrderId !== "string") {
      return NextResponse.json({ error: "Missing paypalOrderId" }, { status: 400 });
    }

    await ensureOrdersTable();

    // Refreshing the return page or navigating back lands here again; an
    // already-paid order short-circuits instead of failing a second capture.
    const { result, order } = await fulfillPayPalOrder(orderId, paypalOrderId);

    if (result === "order-not-found") {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (result === "order-mismatch") {
      return NextResponse.json({ error: "PayPal order mismatch" }, { status: 400 });
    }
    if (result === "amount-mismatch") {
      return NextResponse.json({ error: "Order changed, please try again" }, { status: 409 });
    }
    if (result === "not-captured") {
      return NextResponse.json({ error: "PayPal capture not completed" }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      value: order?.total_local ?? order?.total_usd ?? null,
      valueUsd: order
        ? Math.max(0, Number(order.total_usd) - Number(order.discount_amount || 0))
        : null,
      currency: order?.currency ?? "USD",
    });
  } catch (error) {
    console.error("PayPal capture error:", error);
    await sendTelegramMessage(
      `🚨 <b>PayPal capture-order failed</b>\nA payment may have been approved by the customer but not recorded.\nError: ${
        error instanceof Error ? error.message : String(error)
      }`
    ).catch(() => {});
    return NextResponse.json(
      { error: "Failed to capture PayPal order" },
      { status: 500 }
    );
  }
}
