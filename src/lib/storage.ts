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

export function publicUrlFor(path: string): string {
  return getSupabaseAdmin().storage.from(STORAGE_BUCKET).getPublicUrl(path).data
    .publicUrl;
}
