import { del as deleteBlob } from "@vercel/blob";
import { createClient } from "@supabase/supabase-js";
import {
  deleteFromMedia,
  isMediaUrl,
  keyFromMediaUrl,
  uploadToMedia,
} from "@/lib/mediaHost";

export const STORAGE_BUCKET = "orders";

let cached: ReturnType<typeof createClient> | null = null;

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  }
  if (!cached) {
    cached = createClient(url, key, { auth: { persistSession: false } });
  }
  return cached;
}

/**
 * Stores an object and returns its public URL.
 *
 * Everything uploads to media.afrobirthday.com, a plain file server we run.
 * Storage has moved three times before — an early Vercel Blob store, Supabase
 * Storage, then a second Vercel Blob store — and the first two are now 403 and
 * 402 respectively, which is 421 delivered files no customer can reach. Each
 * break happened because the URL carried a vendor's hostname. This one carries
 * ours, so the next move is a DNS record rather than another dead corpus.
 *
 * `overwrite` is no longer a flag: a PUT to the same key always replaces it.
 * Callers that regenerate a file at a fixed key (voiceovers, downloaded music)
 * rely on that, and the server sends those paths a one-minute cache so the
 * previous take stops being served promptly — the role `cacheSeconds` used to
 * play. Both options stay in the signature so call sites read unchanged.
 */
export async function uploadObject(
  key: string,
  body: Buffer | File | Blob | ArrayBuffer,
  options: { contentType: string; overwrite?: boolean; cacheSeconds?: number }
): Promise<string> {
  const payload =
    body instanceof Blob
      ? body
      : new Blob([body as BlobPart], { type: options.contentType });
  return uploadToMedia(key, payload, options.contentType);
}

/** Reverses publicUrlFor: extracts the storage key from a public bucket URL. */
export function keyFromPublicUrl(url: string): string | null {
  const marker = `/public/${STORAGE_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.slice(idx + marker.length));
}

export async function deleteObject(key: string): Promise<void> {
  const { error } = await getSupabaseAdmin().storage.from(STORAGE_BUCKET).remove([key]);
  if (error) throw error;
}

/**
 * Deletes a stored photo whatever backend it lives on, and reports whether it
 * could. Four shapes exist in the database: our own host for anything uploaded
 * since the move, Vercel Blob and Supabase Storage for the two periods before
 * it, and an older Vercel Blob store left behind in a team migration and
 * suspended, which will never delete. The caller must not clear the database
 * pointer when this returns false, or the file becomes an unreachable orphan
 * that stays publicly readable.
 */
export async function deletePhotoByUrl(url: string): Promise<boolean> {
  if (isMediaUrl(url)) {
    const key = keyFromMediaUrl(url);
    if (!key) return false;
    // Throws on a server error, which is what we want: the caller leaves the
    // row alone and retries on the next run.
    await deleteFromMedia(key);
    return true;
  }

  const key = keyFromPublicUrl(url);
  if (key) {
    await deleteObject(key);
    return true;
  }

  if (url.includes(".blob.vercel-storage.com/")) {
    await deleteBlob(url, { token: process.env.BLOB_READ_WRITE_TOKEN });
    return true;
  }

  return false;
}
