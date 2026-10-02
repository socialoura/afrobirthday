import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";

/** Constant-time string comparison (hashes first so lengths always match). */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/**
 * Fails CLOSED: returns an error response when CRON_SECRET is missing or the
 * Bearer token does not match, null when the caller is authorized.
 * The older `if (cronSecret && header !== ...)` guard made every cron public
 * whenever CRON_SECRET was unset.
 */
export function rejectUnauthorizedCron(request: Request, name: string): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error(`Cron ${name} refused to run: CRON_SECRET is not configured`);
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const header = request.headers.get("authorization") ?? "";
  if (!safeEqual(header, `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
