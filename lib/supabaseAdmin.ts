import { createClient } from "@supabase/supabase-js";

// SERVER-ONLY client. Uses the secret/service-role key so API routes
// (submit, check-wl, stats, admin) can reliably read/write regardless
// of Row Level Security policies on the tables.
//
// NEVER import this file from a "use client" component or anything
// that ships to the browser bundle — the secret key must stay server-side.
const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SECRET_KEY environment variables. " +
      "Server-side Supabase calls will fail."
  );
}

export const supabaseAdmin = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseSecretKey || "placeholder-key",
