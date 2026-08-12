import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "https://aqwvvjxepzdityomduuf.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_RO2LtdauXvsd3zOddBXBuQ_JEpmMU15";

export const supabase = createClient(supabaseUrl, supabaseKey);
