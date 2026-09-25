import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Client Supabase con la sessione dell'utente: ogni query passa dalle regole RLS del database. */
export async function supabase() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: list => {
        try { list.forEach(({ name, value, options }) => store.set(name, value, options)); }
        catch { /* chiamato da un Server Component: la sessione viene aggiornata dal proxy */ }
      },
    },
  });
}

export type Role = "admin" | "hr" | "hr_rischio" | "revisore" | "lettore";
export interface Membership { org_id: string; role: Role; organizations: { name: string } }

/** Utente collegato e prima azienda di cui fa parte (per ora un utente = un'azienda). */
export async function session() {
  const sb = await supabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { sb, user: null, membership: null };
  const { data } = await sb.from("memberships").select("org_id, role, organizations(name)").eq("user_id", user.id).limit(1).maybeSingle();
  return { sb, user, membership: data as unknown as Membership | null };
}

export const canSeePay = (r?: Role) => r === "admin" || r === "hr" || r === "hr_rischio";
