import { NextRequest, NextResponse } from "next/server";
import { ensureOrdersTable, getOrderById, markOrderPaidPayPal } from "@/lib/db";
import { sendOrderPaidDiscord } from "@/lib/discordWebhook";
import { capturePayPalOrder } from "@/lib/paypal";
import { sendEmailWithResend } from "@/lib/resend";
import {
  renderOrderConfirmationEmailHtml,
  renderOrderConfirmationEmailText,
} from "@/lib/orderEmailTemplates";

export const runtime = "nodejs";

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

    const existingOrder = await getOrderById(orderId);
    const wasAlreadyPaid = existingOrder?.status === "paid";

    const capture = await capturePayPalOrder(paypalOrderId);

    if (capture.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "PayPal capture not completed", status: capture.status },
        { status: 400 }
      );
    }

    if (!wasAlreadyPaid) {
      await markOrderPaidPayPal(orderId, capture.captureId);
    }

    const order = (await getOrderById(orderId)) ?? existingOrder;

    if (!wasAlreadyPaid && order?.email) {
      try {
        await sendEmailWithResend({
          to: order.email,
          subject: `AfroBirthday order confirmation (${order.id})`,
          html: renderOrderConfirmationEmailHtml(order),
          text: renderOrderConfirmationEmailText(order),
        });
      } catch (emailErr) {
        console.error("Failed to send order confirmation email (PayPal):", emailErr);
      }
    }

    if (order) {
      await sendOrderPaidDiscord({
        order,
        provider: "PayPal",
        amountLabel: `$${Number(order.total_usd).toFixed(2)} USD`,
        paymentRef: capture.captureId ?? paypalOrderId,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PayPal capture error:", error);
    return NextResponse.json(
      { error: "Failed to capture PayPal order" },
      { status: 500 }
    );
  }
}
