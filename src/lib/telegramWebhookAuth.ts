import { timingSafeEqual } from "node:crypto";

const TELEGRAM_SECRET_TOKEN_PATTERN = /^[A-Za-z0-9_-]{1,256}$/;

export function isTelegramWebhookSecretConfigured(
  secret: string | undefined
): secret is string {
  return Boolean(secret && TELEGRAM_SECRET_TOKEN_PATTERN.test(secret));
}

export function isTelegramWebhookSecretValid(
  receivedSecret: string | null,
  expectedSecret: string | undefined
): boolean {
  if (!receivedSecret || !isTelegramWebhookSecretConfigured(expectedSecret)) {
    return false;
  }

  const received = Buffer.from(receivedSecret, "utf8");
  const expected = Buffer.from(expectedSecret, "utf8");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function isAllowedTelegramChat(
  chatId: number | string | null | undefined,
  chatType: string | null | undefined,
  senderId: number | string | null | undefined,
  allowedChatId: string | undefined
): boolean {
  const expectedChatId = allowedChatId?.trim();
  if (
    !expectedChatId ||
    !/^\d+$/.test(expectedChatId) ||
    chatType !== "private" ||
    chatId == null ||
    senderId == null
  ) {
    return false;
  }

  return String(chatId) === expectedChatId && String(senderId) === expectedChatId;
}
