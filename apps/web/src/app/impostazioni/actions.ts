"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { DEFAULT_SETTINGS, SETTINGS_FIELDS, type Settings } from "@/lib/settings";
import { canSeePay, isAdmin, session, type Role } from "@/lib/supabase/server";

export async function saveSettings(fd: FormData) {
  const { sb, membership } = await session();
  if (!membership || !canSeePay(membership)) redirect("/");
  const data: Record<string, string | number> = {};
  for (const [k, , t] of SETTINGS_FIELDS) {
    const v = String(fd.get(k) ?? "").trim();
    data[k] = t === "number" ? (Number.parseFloat(v.replace(",", ".")) || (DEFAULT_SETTINGS[k] as number)) : v;
  }
  const { error } = await sb.from("org_settings").upsert({ org_id: membership.org_id, data: data as Partial<Settings>, updated_at: new Date().toISOString() });
  redirect(`/impostazioni?${error ? "e=" + encodeURIComponent(error.message) : "m=" + encodeURIComponent("Impostazioni salvate")}`);
}

const ROLES: Role[] = ["admin", "hr", "hr_rischio", "revisore", "lettore"];

/** L'amministratore attiva o disattiva un proprio ruolo. Resta traccia nel registro attività. */
export async function toggleMyRole(role: Role) {
  const { sb, user, membership } = await session();
  if (!user || !membership || !isAdmin(membership) || !ROLES.includes(role)) redirect("/");
  if (role === "admin") redirect("/impostazioni?e=" + encodeURIComponent("Il ruolo di amministratore non si può togliere da qui."));
  const has = membership.roles.includes(role);
  const q = has
    ? sb.from("memberships").delete().eq("org_id", membership.org_id).eq("user_id", user.id).eq("role", role)
    : sb.from("memberships").insert({ org_id: membership.org_id, user_id: user.id, role });
  const { error } = await q;
  revalidatePath("/", "layout");
  redirect(`/impostazioni?${error ? "e=" + encodeURIComponent(error.message) : "m=" + encodeURIComponent("Ruoli aggiornati")}`);
}
