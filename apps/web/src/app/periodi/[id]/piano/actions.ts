"use server";
import { redirect } from "next/navigation";
import { canSeePay, session } from "@/lib/supabase/server";

const STATI = ["Da fare", "In corso", "Fatto", "Non applicabile"];

export async function saveAction(periodId: string, key: string, fd: FormData) {
  const { sb, membership } = await session();
  if (!membership || !canSeePay(membership)) redirect(`/periodi/${periodId}/piano`);
  const status = String(fd.get("status"));
  const due = String(fd.get("due") ?? "");
  const { error } = await sb.from("action_items").upsert({
    org_id: membership.org_id, period_id: periodId, key,
    status: STATI.includes(status) ? status : "Da fare",
    owner: String(fd.get("owner") ?? "").trim().slice(0, 200) || null,
    due_on: /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : null,
    note: String(fd.get("note") ?? "").trim().slice(0, 2000) || null,
  });
  redirect(`/periodi/${periodId}/piano?${error ? "e=" + encodeURIComponent(error.message) : "m=" + encodeURIComponent("Azione aggiornata")}#a-${encodeURIComponent(key)}`);
}
