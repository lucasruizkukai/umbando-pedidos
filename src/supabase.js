import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://vewiuuhhossokfhaqkud.supabase.co";
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_jwkS9S5BAffqqdxSaGKdEQ_WbprGVp3";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
