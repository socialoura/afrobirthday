import { NextResponse } from "next/server";
import { getOrderById, setOrderMedia } from "@/lib/db";
import { musicJobUrl, UUID, verifyMusicResult } from "@/lib/musicDownloader";
import { sendTelegramAudio, sendTelegramMessage } from "@/lib/telegramBot";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const body = await request.text();
  if (body.length > 16_384) return NextResponse.json({ error: "Too large" }, { status: 413 });
  if (!verifyMusicResult(request, body)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = JSON.parse(body);
    if (!UUID.test(result.jobId) || !UUID.test(result.orderId) || !["ready", "failed"].includes(result.result)) {
      return NextResponse.json({ error: "Invalid result" }, { status: 400 });
    }
    const order = await getOrderById(result.orderId);
    // A result for an old link must never replace a subsequently uploaded MP3.
    if (!order || order.status !== "paid" || order.music_option !== "custom" || order.music_file_url || order.music_link !== result.musicLink) {
      return NextResponse.json({ error: "Order or source changed" }, { status: 409 });
    }
    const short = order.id.slice(0, 8);
    if (result.result === "failed") {
      const response = await sendTelegramMessage(`⚠️ <b>MP3 MANQUANT</b> — <code>${short}</code>\nLe téléchargement du lien est bloqué ou aucun morceau complet correspondant n'a été trouvé. Récupération manuelle nécessaire ; ne pas lancer la production sans la musique.`);
      return response?.ok
        ? NextResponse.json({ ok: true, alerted: true })
        : NextResponse.json({ error: "Alert delivery failed" }, { status: 503 });
    }
    // Derive the ONLY allowed audio URL, rather than accepting one from a caller.
    const url = musicJobUrl(order.id, result.jobId);
    const audio = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(8_000), cache: "no-store" });
    const bytes = Number(audio.headers.get("content-length"));
    if (!audio.ok || !audio.headers.get("content-type")?.startsWith("audio/") || !Number.isFinite(bytes) || bytes < 1024 || bytes > 30 * 1024 * 1024) {
      return NextResponse.json({ error: "Audio not ready" }, { status: 503 });
    }
    await setOrderMedia(order.id, { downloadedMusicUrl: url });
    const receipt = await sendTelegramAudio(url, `🎵 Musique (MP3 téléchargé) — <code>${short}</code>`);
    if (!receipt.ok) return NextResponse.json({ error: "Audio delivery failed" }, { status: 503 });
    return NextResponse.json(receipt);
  } catch {
    console.error("Music result could not be delivered");
    return NextResponse.json({ error: "Result processing failed" }, { status: 503 });
  }
}
