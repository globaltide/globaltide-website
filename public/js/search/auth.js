import { client } from "./config.js";

export async function getSessionUser(){
  const { data } = await client.auth.getSession();
  return data?.session?.user ?? null;
}

export async function loginWithGoogle(){
  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + window.location.pathname }
  });
  if (error) throw new Error(error.message);
}

export async function logout(){
  const { error } = await client.auth.signOut();
  if (error) throw new Error(error.message);
}

export function onAuthChange(cb){
  client.auth.onAuthStateChange((_event, session) => {
    cb(session?.user ?? null);
  });
}
