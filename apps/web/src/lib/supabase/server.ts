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

export type Client = Awaited<ReturnType<typeof supabase>>;
export type Role = "admin" | "hr" | "hr_rischio" | "revisore" | "lettore";
export interface Membership { org_id: string; orgName: string; roles: Role[] }

/** Utente collegato, prima azienda di cui fa parte e tutti i suoi ruoli in quell'azienda. */
export async function session() {
  const sb = await supabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { sb, user: null, membership: null };
  const { data } = await sb.from("memberships").select("org_id, role, organizations(name)").eq("user_id", user.id).order("created_at");
  const rows = (data ?? []) as unknown as { org_id: string; role: Role; organizations: { name: string } }[];
  if (!rows.length) return { sb, user, membership: null };
  const org = rows[0]!.org_id;
  const membership: Membership = { org_id: org, orgName: rows[0]!.organizations.name, roles: rows.filter(r => r.org_id === org).map(r => r.role) };
  return { sb, user, membership };
}

const any = (m: Membership | null | undefined, rs: Role[]) => !!m && m.roles.some(r => rs.includes(r));
export const canSeePay = (m?: Membership | null) => any(m, ["admin", "hr", "hr_rischio"]);
export const canRisk = (m?: Membership | null) => any(m, ["hr_rischio"]);
export const isAdmin = (m?: Membership | null) => any(m, ["admin"]);
