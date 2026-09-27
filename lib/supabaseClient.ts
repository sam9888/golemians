import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY " +
      "environment variables. Supabase calls will fail until these are set " +
      "(e.g. in your Vercel project's Environment Variables settings)."
  );
}

// createClient() throws on an empty/invalid URL, which would crash the whole
// build. Fall back to a syntactically valid placeholder so the build always
// succeeds - real calls still fail loudly at runtime if env vars are missing.
export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseKey || "placeholder-key"
);
