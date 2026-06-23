import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client using the SERVICE ROLE key, for avatar uploads to
 * the public 'avatars' bucket. Never import this from client code, and never
 * expose SUPABASE_SERVICE_ROLE_KEY to the browser.
 */

export const AVATAR_BUCKET = "avatars";
export const EVENT_COVER_BUCKET = "event-covers";

let cached: SupabaseClient | null = null;

export function getStorageClient(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set");
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
