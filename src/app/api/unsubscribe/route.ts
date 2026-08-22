import { NextResponse } from "next/server";
import { verifyUnsubscribeToken } from "@/lib/auth";
import { addEmailOptOut } from "@/lib/db";

export const runtime = "nodejs";

/**
 * One-click unsubscribe target for the automated marketing emails.
 *
 * GET  — the link in the email footer; opts the address out and shows a
 *        confirmation page.
 * POST — RFC 8058 one-click, what Gmail/Outlook's "Unsubscribe" button calls
 *        via the List-Unsubscribe-Post header.
 *
 * Both are unauthenticated by necessity, so the address is signed (see
 * createUnsubscribeToken) — you can only opt out an address you were given a
 * link for, not an arbitrary one.
 */

function decodeEmail(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const pad = raw.length % 4 === 0 ? "" : "=".repeat(4 - (raw.length % 4));
    const email = Buffer.from(
      raw.replace(/-/g, "+").replace(/_/g, "/") + pad,
      "base64"
    ).toString("utf-8");
    return email.includes("@") ? email : null;
  } catch {
    return null;
  }
}

function resolveRequest(request: Request): { email: string } | { error: string } {
  const url = new URL(request.url);
  const email = decodeEmail(url.searchParams.get("e"));
  const token = url.searchParams.get("t");

  if (!email || !token) return { error: "This unsubscribe link is incomplete." };
  if (!verifyUnsubscribeToken(email, token)) {
    return { error: "This unsubscribe link is invalid or has been altered." };
  }
  return { email };
}

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function page(title: string, body: string, status: number) {
  return new NextResponse(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>${escapeHtml(title)} — AfroBirthday</title>
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 48px 24px;">
    <h1 style="font-size: 22px; margin: 0 0 16px;">${escapeHtml(title)}</h1>
    ${body}
    <p style="margin: 32px 0 0; font-size: 13px; color: #888;">
      AfroBirthday — Personalized birthday videos<br/>
      Questions? <a href="mailto:support@afrobirthday.com" style="color: #888;">support@afrobirthday.com</a>
    </p>
  </body>
</html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

export async function GET(request: Request) {
  const resolved = resolveRequest(request);

  if ("error" in resolved) {
    return page(
      "We couldn't process that",
      `<p style="margin:0;">${escapeHtml(resolved.error)} Email
        <a href="mailto:support@afrobirthday.com?subject=unsubscribe" style="color: #c2410c;">support@afrobirthday.com</a>
        and we'll take care of it for you.</p>`,
      400
    );
  }

  try {
    await addEmailOptOut(resolved.email, "link");
  } catch (err) {
    console.error("Unsubscribe failed:", err);
    return page(
      "Something went wrong",
      `<p style="margin:0;">We couldn't record your request just now. Please email
        <a href="mailto:support@afrobirthday.com?subject=unsubscribe" style="color: #c2410c;">support@afrobirthday.com</a>
        and we'll remove you manually.</p>`,
      500
    );
  }

  return page(
    "You're unsubscribed",
    `<p style="margin:0 0 16px;"><strong>${escapeHtml(resolved.email)}</strong> won't receive any more
      review requests, offers, or reminders from us.</p>
    <p style="margin:0;">You'll still get emails about orders you place — the confirmation and your
      finished video — because those are part of the order itself.</p>`,
    200
  );
}

export async function POST(request: Request) {
  const resolved = resolveRequest(request);

  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: 400 });
  }

  try {
    await addEmailOptOut(resolved.email, "one-click");
  } catch (err) {
    console.error("One-click unsubscribe failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
