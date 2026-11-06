import { createCipheriv, createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { signedUploadUrl, publicUrlForKey } from "@/lib/mediaHost";
import { compareStringsConstantTime } from "@/lib/auth";

export type MusicJob = { jobId: string; orderId: string; musicLink: string; createdAt: number };
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function secret(): string {
  const value = process.env.ADMIN_TOKEN_SECRET;
  if (!value || value.length < 32) throw new Error("Music worker secret not configured");
  return value;
}

export function supportedMusicLink(link: string): boolean {
  try {
    const url = new URL(link);
    if (url.protocol !== "https:" || url.username || url.password || url.port || link.length > 2048) return false;
    const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");
    return ["youtube.com", "music.youtube.com", "youtu.be", "open.spotify.com", "spotify.com", "spotify.link", "soundcloud.com", "on.soundcloud.com"].includes(host)
      || /^[a-z0-9-]+\.bandcamp\.com$/.test(host);
  } catch { return false; }
}

// The media host has no public directory listing. Encrypt as well: even a leaked
// queue URL must not disclose the customer's link or a callback capability.
export function encryptMusicJob(job: MusicJob): string {
  const key = createHash("sha256").update(`afrobirthday-music-jobs\n${secret()}`).digest();
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(job), "utf8"), cipher.final()]);
  return JSON.stringify({ v: 1, nonce: nonce.toString("base64"), ciphertext: ciphertext.toString("base64"), tag: cipher.getAuthTag().toString("base64") });
}

export function signMusicResult(body: string, timestamp: string): string {
  return createHmac("sha256", secret()).update(`afrobirthday-music-result\n${timestamp}\n${body}`).digest("hex");
}

export function verifyMusicResult(request: Request, body: string): boolean {
  try {
    const timestamp = request.headers.get("x-music-timestamp") || "";
    const signature = request.headers.get("x-music-signature") || "";
    if (!/^\d{13}$/.test(timestamp) || Math.abs(Date.now() - Number(timestamp)) > 5 * 60_000) return false;
    return compareStringsConstantTime(signature, signMusicResult(body, timestamp));
  } catch { return false; }
}

export function musicJobUrl(orderId: string, jobId: string): string {
  return publicUrlForKey(`orders/music/${orderId}-${jobId}.mp3`);
}

export async function queueMusicDownload(musicLink: string, orderId: string): Promise<{ queued: boolean; jobId?: string; error?: string }> {
  if (process.env.DISABLE_MUSIC_AUTO_DOWNLOAD === "true") return { queued: false, error: "Téléchargement automatique désactivé" };
  if (!UUID.test(orderId) || !supportedMusicLink(musicLink)) return { queued: false, error: "Lien musique non pris en charge" };
  try {
    const job: MusicJob = { jobId: randomUUID(), orderId, musicLink, createdAt: Date.now() };
    const payload = encryptMusicJob(job);
    const { uploadUrl } = signedUploadUrl(`orders/music-jobs/${job.jobId}.json`, 16_384, 60);
    const response = await fetch(uploadUrl, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: new Blob([payload]), signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error("Queue upload rejected");
    return { queued: true, jobId: job.jobId };
  } catch {
    // Never log a signed upload URL, its secret, or a provider response.
    console.error("Music job could not be queued", orderId);
    return { queued: false, error: "Service musique indisponible — récupération manuelle nécessaire" };
  }
}
