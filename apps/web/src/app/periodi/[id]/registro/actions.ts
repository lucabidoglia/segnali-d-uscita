"use server";
import { redirect } from "next/navigation";
import { canRisk, session } from "@/lib/supabase/server";

const STATI = ["Aperto", "In corso", "Chiuso"];

export async function updateCase(periodId: string, caseId: string, fd: FormData) {
  const { sb, membership } = await session();
  if (!canRisk(membership)) redirect(`/periodi/${periodId}`);
  const status = String(fd.get("status"));
  const note = String(fd.get("note") ?? "").trim() || null;
  const { error } = await sb.from("cases").update({ status: STATI.includes(status) ? status : "Aperto", note }).eq("id", caseId);
  redirect(`/periodi/${periodId}/registro?${error ? "e=" + encodeURIComponent(error.message) : "m=" + encodeURIComponent("Caso aggiornato")}`);
}

export async function deleteCase(periodId: string, caseId: string) {
  const { sb, membership } = await session();
  if (!canRisk(membership)) redirect(`/periodi/${periodId}`);
  const { error } = await sb.from("cases").delete().eq("id", caseId);
  redirect(`/periodi/${periodId}/registro?${error ? "e=" + encodeURIComponent(error.message) : "m=" + encodeURIComponent("Caso eliminato (resta traccia nel registro attività)")}`);
}
