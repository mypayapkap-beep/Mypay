import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "https://placeholder.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-service-role-key";
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? "placeholder-anon-key";

const hasSupabase = !!(
  process.env.SUPABASE_URL &&
  process.env.SUPABASE_SERVICE_ROLE_KEY &&
  process.env.SUPABASE_ANON_KEY
);

if (!hasSupabase) {
  console.warn(
    "[supabase] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY not set. " +
      "User auth (OTP login) will be unavailable. Admin login uses local JWT — no Supabase needed.",
  );
}

export const supabaseAdmin = createClient(
  SUPABASE_URL,
  SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

export const supabaseAnon = createClient(
  SUPABASE_URL,
  ANON_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

export { SUPABASE_URL, ANON_KEY as SUPABASE_ANON_KEY };
