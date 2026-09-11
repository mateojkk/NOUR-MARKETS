import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://hlptdpjopyswucsvtere.supabase.co";

const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhscHRkcGpvcHlzd3Vjc3Z0ZXJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNTc5ODcsImV4cCI6MjEwNDYzMzk4N30.AaPbl_2_vViDio5ahWHUXf6zJD2lu_xwBVArg8qd0yE";

let _supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!_supabaseClient) {
    _supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });
  }
  return _supabaseClient;
}
