import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const auth = await import("../src/lib/telegramWebhookAuth.ts").catch(() => null);

test("requires a configured secret using Telegram's allowed token syntax", () => {
  assert.equal(auth?.isTelegramWebhookSecretConfigured?.(undefined), false);
  assert.equal(auth?.isTelegramWebhookSecretConfigured?.("bad secret"), false);
  assert.equal(auth?.isTelegramWebhookSecretConfigured?.("valid_secret-123"), true);
});

test("rejects a missing, malformed, or incorrect webhook secret", () => {
  assert.equal(auth?.isTelegramWebhookSecretValid?.(null, "valid_secret-123"), false);
  assert.equal(auth?.isTelegramWebhookSecretValid?.("wrong", "valid_secret-123"), false);
  assert.equal(auth?.isTelegramWebhookSecretValid?.("bad secret", "bad secret"), false);
  assert.equal(auth?.isTelegramWebhookSecretValid?.("valid_secret-123", undefined), false);
});

test("accepts the configured Telegram webhook secret", () => {
  assert.equal(
    auth?.isTelegramWebhookSecretValid?.("valid_secret-123", "valid_secret-123"),
    true
  );
});

test("only authorizes the configured owner in a private chat", () => {
  assert.equal(auth?.isAllowedTelegramChat?.(123456789, "private", 123456789, "123456789"), true);
  assert.equal(auth?.isAllowedTelegramChat?.(123456789, "group", 123456789, "123456789"), false);
  assert.equal(auth?.isAllowedTelegramChat?.(123456789, "private", 123, "123456789"), false);
  assert.equal(auth?.isAllowedTelegramChat?.(123, "private", 123, "123456789"), false);
  assert.equal(auth?.isAllowedTelegramChat?.(123456789, "private", 123456789, undefined), false);
});

test("webhook authenticates before parsing and filters the chat before commands", async () => {
  const route = await readFile(
    new URL("../src/app/api/telegram/webhook/route.ts", import.meta.url),
    "utf8"
  );
  const authCheckIndex = route.indexOf("!isTelegramWebhookSecretValid(");
  const parseIndex = route.indexOf("request.json()");
  const allowlistIndex = route.indexOf("!isAllowedTelegramChat(");
  const commandIndex = route.indexOf('text === "/start"');

  assert.ok(authCheckIndex >= 0 && authCheckIndex < parseIndex);
  assert.ok(allowlistIndex > parseIndex && allowlistIndex < commandIndex);
});
