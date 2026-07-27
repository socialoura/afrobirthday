import { NextResponse } from "next/server";
import { verifyUploadToken } from "@/lib/auth";
import { getOrderById, setOrderMedia } from "@/lib/db";
import { describeVoiceoverFailure, generateVoiceover } from "@/lib/voiceover";

export const runtime = "nodejs";
// OpenAI TTS + the Supabase upload can take a while on a long message.
export const maxDuration = 60;

// Regenerates the voiceover MP3 for one order on demand, from the recap page.
// Authorized by the same order-scoped upload token as the recap itself — no
// admin session required, since the operator reaches this from the Telegram
// magic link.
//
// Unlike the automatic path this calls generateVoiceover directly, bypassing
// the language heuristic: a manual click is an explicit "I want a vocal for
// this message", whatever the language detector thinks.
export async function POST(request: Request) {
  let orderId = "";
  let token = "";
  try {
    const body = (await request.json()) as { orderId?: string; token?: string };
    orderId = body.orderId ?? "";
    token = body.token ?? "";
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const upload = verifyUploadToken(token);
  if (!upload || upload.orderId !== orderId) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });
  }

  try {
    const order = await getOrderById(orderId);
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (!order.message?.trim()) {
      return NextResponse.json(
        { error: "Cette commande n'a pas de message.", reason: "empty-message" },
        { status: 400 }
      );
    }

    const result = await generateVoiceover(order.message, order.id);
    if (!result.ok) {
      return NextResponse.json(
        {
          error: `Génération échouée — ${describeVoiceoverFailure(result.reason)}`,
          reason: result.reason,
          detail: result.detail,
        },
        { status: 502 }
      );
    }

    await setOrderMedia(order.id, { voiceoverUrl: result.url });
    return NextResponse.json({ voiceoverUrl: result.url });
  } catch (error) {
    console.error("Regenerate voiceover error:", error);
    return NextResponse.json(
      { error: "Erreur serveur lors de la génération." },
      { status: 500 }
    );
  }
}
