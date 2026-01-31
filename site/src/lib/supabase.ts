import { createClient, SupabaseClient } from "@supabase/supabase-js";

let supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (supabase) return supabase;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase configuration missing. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"
    );
  }

  supabase = createClient(supabaseUrl, supabaseAnonKey);
  return supabase;
}

export async function addToWaitlist(email: string, willPay: boolean) {
  const client = getSupabase();

  const { data, error } = await client
    .from("waitlist")
    .insert([
      {
        email,
        will_pay: willPay,
        source: "landing_page",
      },
    ])
    .select();

  if (error) throw error;
  return data;
}
