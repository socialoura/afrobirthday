import crypto from "node:crypto";

/**
 * Signed access to the self-hosted media server (media.afrobirthday.com).
 *
 * Files used to live on Vercel Blob and, before that, on Supabase Storage and on
 * a Vercel store that was left behind in a team migration. Two of those three are
 * now unreachable — 403 and 402 respectively — taking 421 delivered files with
 * them. The lesson is in the hostname: this one is a subdomain of the site, so a
 * future move of the underlying box is a DNS change, not another dead corpus.
 *
 * The upload endpoint is public, so every write carries an HMAC over the exact
 * key, an expiry and a size ceiling. The browser never sees the secret: the
 * server signs, the browser replays the signature it was handed.
 */

export const MEDIA_BASE =
  process.env.MEDIA_PUBLIC_BASE || "https://media.afrobirthday.com";

/** Host of MEDIA_BASE, for recognising URLs we own. */
export function mediaHost(): string {
  try {
    return new URL(MEDIA_BASE).host;
  } catch {
    return "media.afrobirthday.com";
  }
}

export function isMediaUrl(url: string): boolean {
  try {
    return new URL(url).host === mediaHost();
  } catch {
    return false;
  }
}

/** Reverses publicUrlFor for our own host: URL back to storage key. */
export function keyFromMediaUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.host !== mediaHost()) return null;
    const key = decodeURIComponent(u.pathname.replace(/^\//, ""));
    return key || null;
  } catch {
    return null;
  }
}

function secret(): string {
  const s = process.env.MEDIA_UPLOAD_SECRET;
  // Fail loudly rather than signing with "undefined", which the server would
  // reject as a bad signature and which reads like a network fault in the logs.
  if (!s || s.length < 32) {
    throw new Error("MEDIA_UPLOAD_SECRET is not configured");
  }
  return s;
}

function sign(op: "put" | "del", key: string, exp: number, max: number): string {
  return crypto
    .createHmac("sha256", secret())
    .update(`${op}\n${key}\n${exp}\n${max}`)
    .digest("hex");
}

/** Public URL a given key will be served at once uploaded. */
export function publicUrlForKey(key: string): string {
  const path = key.split("/").map(encodeURIComponent).join("/");
  return `${MEDIA_BASE.replace(/\/$/, "")}/${path}`;
}

/**
 * A URL the holder may PUT one file to, and the URL it will be readable at.
 * `ttlSeconds` must outlast the whole transfer: a phone on mobile data uploading
 * a video needs far more than the seconds a token normally lives.
 */
export function signedUploadUrl(
  key: string,
  maxBytes: number,
  ttlSeconds: number
): { uploadUrl: string; publicUrl: string; expiresAt: number } {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = sign("put", key, exp, maxBytes);
  const path = key.split("/").map(encodeURIComponent).join("/");
  return {
    uploadUrl: `${MEDIA_BASE.replace(/\/$/, "")}/_upload/${path}?exp=${exp}&max=${maxBytes}&sig=${sig}`,
    publicUrl: publicUrlForKey(key),
    expiresAt: exp * 1000,
  };
}

/** Server-side upload. Returns the public URL. */
export async function uploadToMedia(
  key: string,
  body: Buffer | Uint8Array | ArrayBuffer | Blob,
  contentType: string,
  maxBytes = 2 * 1024 * 1024 * 1024
): Promise<string> {
  const { uploadUrl, publicUrl } = signedUploadUrl(key, maxBytes, 600);
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: body instanceof Blob ? body : new Blob([body as BlobPart]),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Media upload failed (${res.status}): ${detail.slice(0, 200)}`);
  }
  return publicUrl;
}

/** Server-side delete. Missing files count as deleted. */
export async function deleteFromMedia(key: string): Promise<void> {
  const exp = Math.floor(Date.now() / 1000) + 300;
  const sig = sign("del", key, exp, 0);
  const path = key.split("/").map(encodeURIComponent).join("/");
  const res = await fetch(
    `${MEDIA_BASE.replace(/\/$/, "")}/_upload/${path}?exp=${exp}&max=0&sig=${sig}`,
    { method: "DELETE" }
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Media delete failed (${res.status}): ${detail.slice(0, 200)}`);
  }
}
