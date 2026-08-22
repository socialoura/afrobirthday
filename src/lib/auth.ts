import { createHmac, timingSafeEqual } from "crypto";

export type AdminToken = {
  username: string;
  role: "admin";
  exp: number;
};

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function getSecret(): string {
  const secret = process.env.ADMIN_TOKEN_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "ADMIN_TOKEN_SECRET env var missing or too short (need >= 32 chars)"
    );
  }
  return secret;
}

function base64UrlEncode(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(str: string): Buffer {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function sign(payload: string): string {
  return base64UrlEncode(
    createHmac("sha256", getSecret()).update(payload).digest()
  );
}

export function createAdminToken(username: string): string {
  const payload: AdminToken = {
    username,
    role: "admin",
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const body = base64UrlEncode(Buffer.from(JSON.stringify(payload), "utf-8"));
  const sig = sign(body);
  return `${body}.${sig}`;
}

export function verifyAdminToken(token: string): AdminToken | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [body, sig] = parts;

    const expected = sign(body);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    const decoded = JSON.parse(
      base64UrlDecode(body).toString("utf-8")
    ) as AdminToken;
    if (decoded.role !== "admin") return null;
    if (typeof decoded.exp !== "number" || decoded.exp < Date.now()) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return null;
  return parts[1];
}

export function verifyAdminRequest(request: Request): AdminToken | null {
  const authHeader = request.headers.get("Authorization");
  const token = extractBearerToken(authHeader);
  if (!token) return null;
  return verifyAdminToken(token);
}

// --- Order-scoped upload token ---------------------------------------------
// A magic-link token that grants the ability to upload (and deliver) the final
// video for ONE specific order, nothing else. Used by the mobile upload page
// reachable from the Discord new-order notification. Signed with the same HMAC
// secret as the admin session token but with a longer TTL and a narrow scope,
// so a leaked link can't compromise the full admin dashboard.

export type UploadToken = {
  orderId: string;
  scope: "upload";
  exp: number;
};

const UPLOAD_TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

export function createUploadToken(orderId: string): string {
  const payload: UploadToken = {
    orderId,
    scope: "upload",
    exp: Date.now() + UPLOAD_TOKEN_TTL_MS,
  };
  const body = base64UrlEncode(Buffer.from(JSON.stringify(payload), "utf-8"));
  const sig = sign(body);
  return `${body}.${sig}`;
}

export function verifyUploadToken(token: string): UploadToken | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [body, sig] = parts;

    const expected = sign(body);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    const decoded = JSON.parse(
      base64UrlDecode(body).toString("utf-8")
    ) as UploadToken;
    if (decoded.scope !== "upload") return null;
    if (typeof decoded.orderId !== "string" || !decoded.orderId) return null;
    if (typeof decoded.exp !== "number" || decoded.exp < Date.now()) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function compareStringsConstantTime(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf-8");
  const bBuf = Buffer.from(b, "utf-8");
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

// --- Unsubscribe token ------------------------------------------------------
// Signs an email address so an unsubscribe link can't be used to opt somebody
// else out. No expiry on purpose: an unsubscribe link has to keep working for
// as long as the email sits in the recipient's mailbox.

function normalizeEmailForToken(email: string): string {
  return email.trim().toLowerCase();
}

export function createUnsubscribeToken(email: string): string {
  return sign(`unsub:${normalizeEmailForToken(email)}`);
}

export function verifyUnsubscribeToken(email: string, token: string): boolean {
  try {
    return compareStringsConstantTime(createUnsubscribeToken(email), token);
  } catch {
    return false;
  }
}
