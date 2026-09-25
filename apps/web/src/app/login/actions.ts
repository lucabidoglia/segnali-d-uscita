"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase/server";

const back = (k: "e" | "m", msg: string) => redirect(`/login?${k}=${encodeURIComponent(msg)}`);

export async function signIn(fd: FormData) {
  const sb = await supabase();
  const { error } = await sb.auth.signInWithPassword({ email: String(fd.get("email")), password: String(fd.get("password")) });
  if (error) back("e", error.message === "Email not confirmed" ? "Email non ancora confermata: apri il link che ti abbiamo mandato." : "Email o password non corretti.");
  redirect("/");
}

export async function signUp(fd: FormData) {
  const password = String(fd.get("password"));
  if (password.length < 10) back("e", "La password deve avere almeno 10 caratteri.");
  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  const sb = await supabase();
  const { data, error } = await sb.auth.signUp({ email: String(fd.get("email")), password, options: { emailRedirectTo: `${origin}/auth/callback` } });
  if (error) back("e", error.message.includes("rate limit") ? "Troppe registrazioni in poco tempo: riprova tra qualche minuto." : error.message);
  // conferma email disattivata (ambiente demo): l'utente è già collegato
  if (data.session) redirect("/");
  back("m", "Fatto! Ti abbiamo mandato un'email: apri il link di conferma, poi accedi.");
}
