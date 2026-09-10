import { del as deleteBlob, put } from "@vercel/blob";
import { createClient } from "@supabase/supabase-js";

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
 * Everything uploads to Vercel Blob, whose bandwidth is part of the hosting
 * plan. Supabase Storage is write-free on purpose: its free tier meters egress,
 * and serving files from it is what restricted the whole project — storage,
 * database and checkout at once — while customers were mid-order. Supabase
 * keeps the database, which barely moves any bytes.
 *
 * `overwrite` reproduces Supabase's `upsert`, for the regenerated files whose
 * URL must stay put. Those pair it with a short cache: the CDN holds a blob for
 * 30 days by default, long enough to keep serving the previous take of a
 * voiceover after it has been redone.
 */
export async function uploadObject(
  key: string,
  body: Buffer | File | Blob | ArrayBuffer,
  options: { contentType: string; overwrite?: boolean; cacheSeconds?: number }
): Promise<string> {
  const { url } = await put(key, body, {
    access: "public",
    contentType: options.contentType,
    addRandomSuffix: false,
    allowOverwrite: options.overwrite ?? false,
    ...(options.cacheSeconds === undefined
      ? {}
      : { cacheControlMaxAge: options.cacheSeconds }),
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
  return url;
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
 * could. Three shapes exist in the database: Vercel Blob for anything uploaded
 * since, Supabase Storage for the middle period, and Vercel Blob again for the
 * oldest rows — those last ones live in a store that was left behind in a team
 * migration and suspended, so they will never delete. The caller must not clear
 * the database pointer when this returns false, or the file becomes an
 * unreachable orphan that stays publicly readable.
 */
export async function deletePhotoByUrl(url: string): Promise<boolean> {
  const key = keyFromPublicUrl(url);
  if (key) {
    await deleteObject(key);
    return true;
  }

  if (url.includes(".blob.vercel-storage.com/")) {
    // Throws when BLOB_READ_WRITE_TOKEN is missing, which is what we want:
    // the caller leaves the row alone and retries on the next run.
    await deleteBlob(url, { token: process.env.BLOB_READ_WRITE_TOKEN });
    return true;
  }

  return false;
}
