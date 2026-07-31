import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  // DEBUG ROUTE — to be removed after verification.
  // Reads the live TELEGRAM_CHAT_ID env var and tries to send a test ping.
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const result: Record<string, unknown> = {
    tokenPresent: Boolean(token),
    tokenLen: token?.length ?? 0,
    chatIdValue: chatId ?? null,
    chatIdLen: chatId?.length ?? 0,
  };

  if (!token || !chatId) {
    return NextResponse.json({ ...result, error: "missing env" });
  }

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `🧪 Debug ping from Vercel runtime — ${new Date().toISOString()}\nTELEGRAM_CHAT_ID seen as: ${chatId} (len ${chatId.length})`,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      }
    );
    const body = await res.text();
    result.telegramStatus = res.status;
    result.telegramBody = body.slice(0, 500);
  } catch (err) {
    result.telegramError = String(err);
  }

  return NextResponse.json(result);
}
