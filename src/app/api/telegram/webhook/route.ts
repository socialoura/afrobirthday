import { NextResponse } from "next/server";
import { getAllOrders } from "@/lib/db";
import {
  sendTelegramMessage,
  buildOrdersListMessage,
  getPendingOrders,
  getOverdueOrders,
  sendOverdueAlerts,
} from "@/lib/telegramBot";

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
    } else if (text === "/chatid") {
      await sendTelegramMessage(
        `🔑 <b>Ton Chat ID :</b> <code>${chatId}</code>\n\n` +
          `Ajoute cette valeur dans ta variable d'environnement <code>TELEGRAM_CHAT_ID</code>`,
        chatId
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Telegram webhook error:", err);
    return NextResponse.json({ ok: true });
  }
}
