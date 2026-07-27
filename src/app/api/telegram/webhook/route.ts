import { NextResponse } from "next/server";
import { getAllOrders, setOrderMedia } from "@/lib/db";
import {
  sendTelegramMessage,
  sendTelegramAudio,
  buildOrdersListMessage,
  getPendingOrders,
  getOverdueOrders,
  sendOverdueAlerts,
} from "@/lib/telegramBot";

export const runtime = "nodejs";
// /vocal runs OpenAI TTS + a Supabase upload, well past the default 10s budget.
export const maxDuration = 60;

type TelegramUpdate = {
  message?: {
    chat: { id: number };
    text?: string;
    from?: { first_name?: string };
  };
};

export async function POST(request: Request) {
  try {
    const update: TelegramUpdate = await request.json();
    const message = update.message;
    if (!message?.text) return NextResponse.json({ ok: true });

    const chatId = String(message.chat.id);
    const text = message.text.trim();

    if (text === "/start") {
      await sendTelegramMessage(
        `👋 <b>Salut ${message.from?.first_name || ""} !</b>\n\n` +
          `Je suis ton assistant AfroBirthday. Voici ce que je peux faire :\n\n` +
          `/orders — Voir la queue de production\n` +
          `/overdue — Voir les commandes en retard\n` +
          `/stats — Stats rapides\n` +
          `/vocal [id] — Générer le vocal d'une commande\n` +
          `/chatid — Afficher ton Chat ID`,
        chatId
      );
    } else if (text === "/orders") {
      const allOrders = await getAllOrders();
      const pending = getPendingOrders(allOrders);
      const msg = buildOrdersListMessage(pending);
      await sendTelegramMessage(msg, chatId);
    } else if (text === "/overdue") {
      const allOrders = await getAllOrders();
      const overdue = getOverdueOrders(allOrders);
      if (overdue.length === 0) {
        await sendTelegramMessage(
          "✅ <b>Aucune commande en retard !</b>\n\nTout est à jour 💪",
          chatId
        );
      } else {
        await sendOverdueAlerts(overdue);
      }
    } else if (text === "/stats") {
      const allOrders = await getAllOrders();
      const paid = allOrders.filter((o) => o.status === "paid");
      const pending = getPendingOrders(allOrders);
      const overdue = getOverdueOrders(allOrders);
      const completed = allOrders.filter((o) => o.order_status === "completed");

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayOrders = paid.filter(
        (o) => new Date(o.created_at) >= todayStart
      );

      let msg = `📊 <b>Stats AfroBirthday</b>\n\n`;
      msg += `🛒 Commandes aujourd'hui: <b>${todayOrders.length}</b>\n`;
      msg += `⏳ En attente de production: <b>${pending.length}</b>\n`;
      msg += `⚠️ En retard: <b>${overdue.length}</b>\n`;
      msg += `✅ Complétées: <b>${completed.length}</b>\n`;
      msg += `💰 Total payées: <b>${paid.length}</b>`;

      await sendTelegramMessage(msg, chatId);
    } else if (text === "/vocal" || text.startsWith("/vocal ")) {
      // Manual voiceover generation. Deliberately bypasses the language
      // heuristic (unlike the automatic pass at payment time): an explicit
      // /vocal means "read this out loud", whatever the detector thinks.
      const arg = text.slice("/vocal".length).trim().toLowerCase();
      const paid = (await getAllOrders()).filter((o) => o.status === "paid");

      let order = paid[0]; // getAllOrders is ordered created_at DESC
      if (arg) {
        const matches = paid.filter((o) => String(o.id).toLowerCase().startsWith(arg));
        if (matches.length === 0) {
          await sendTelegramMessage(
            `❌ Aucune commande payée dont l'ID commence par <code>${arg}</code>.`,
            chatId
          );
          return NextResponse.json({ ok: true });
        }
        if (matches.length > 1) {
          await sendTelegramMessage(
            `⚠️ ${matches.length} commandes commencent par <code>${arg}</code> :\n` +
              matches.map((o) => `<code>${String(o.id).slice(0, 8)}</code>`).join("\n") +
              `\n\nPrécise davantage l'ID.`,
            chatId
          );
          return NextResponse.json({ ok: true });
        }
        order = matches[0];
      }

      if (!order) {
        await sendTelegramMessage("❌ Aucune commande payée.", chatId);
        return NextResponse.json({ ok: true });
      }
      if (!order.message?.trim()) {
        await sendTelegramMessage(
          `❌ La commande <code>${String(order.id).slice(0, 8)}</code> n'a pas de message.`,
          chatId
        );
        return NextResponse.json({ ok: true });
      }

      const short = String(order.id).slice(0, 8);
      await sendTelegramMessage(
        `⏳ Génération du vocal pour <code>${short}</code>…`,
        chatId
      );

      const { generateVoiceover, describeVoiceoverFailure } = await import(
        "@/lib/voiceover"
      );
      const result = await generateVoiceover(order.message, String(order.id));
      if (!result.ok) {
        await sendTelegramMessage(
          `❌ <b>Échec</b> — ${describeVoiceoverFailure(result.reason)}` +
            (result.detail ? `\n<code>${result.detail.slice(0, 200)}</code>` : ""),
          chatId
        );
        return NextResponse.json({ ok: true });
      }

      await setOrderMedia(String(order.id), { voiceoverUrl: result.url });
      await sendTelegramAudio(result.url, `🗣️ Vocal — <code>${short}</code>`, chatId);
    } else if (text === "/chatid") {
      await sendTelegramMessage(
        `🔑 <b>Ton Chat ID :</b> <code>${chatId}</code>\n\n` +
          `Ajoute cette valeur dans ta variable d'environnement <code>TELEGRAM_CHAT_ID</code>`,
        chatId
      );
    } else if (!text.startsWith("/")) {
      const { answerQuestion } = await import("@/lib/telegramAI");
      const answer = await answerQuestion(text, chatId);
      await sendTelegramMessage(answer, chatId);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Telegram webhook error:", err);
    try {
      const { sendTelegramMessage: notify } = await import("@/lib/telegramBot");
      await notify(`❌ Erreur bot: ${err instanceof Error ? err.message : String(err)}`);
    } catch { /* ignore */ }
    return NextResponse.json({ ok: true });
  }
}
