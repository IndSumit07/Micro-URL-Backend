import { createClient } from "@supabase/supabase-js";
import { env } from "./env.js";
const SUPABASE_URL = env.supabaseUrl;
const SUPABASE_SECRET_KEY = env.supabaseSecretKey;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

export default supabase;
