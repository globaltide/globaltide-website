// public/js/search/gt.search.auth.js

const SUPABASE_URL = "https://toppqscjkkmmelpngzda.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_4eEtjEs8RtBFFWnpdTwRfg_DkXpAa7g";

export function createSupabaseClient(){
  if (!window.supabase) throw new Error("supabase-js not loaded");
  return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

export async function getSessionUser(client){
  const { data } = await client.auth.getSession();
  return data?.session?.user ?? null;
}

export async function signInGoogle(client){
  const { error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin + window.location.pathname,
    },
  });
  if (error) throw error;
}

export async function signOut(client){
  const { error } = await client.auth.signOut();
  if (error) throw error;
}
