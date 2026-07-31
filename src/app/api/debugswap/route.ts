import { NextResponse } from "next/server";
export const runtime = "nodejs";
export async function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return NextResponse.json({ err: "missing env" });
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: "🧪 Test post-swap via Vercel — ce message vient du serveur, plus du curl direct.",
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  const body = await res.text();
  return NextResponse.json({ telegramStatus: res.status, body: body.slice(0, 300) });
}
