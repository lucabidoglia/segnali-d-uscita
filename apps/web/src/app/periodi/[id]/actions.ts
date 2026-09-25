"use server";
import { redirect } from "next/navigation";
import { ENGINE_VERSION, payGapReport, validateWorkers } from "@g1g10/engine";
import { parseWorkbook, type RowIssue } from "@/lib/excel";
import { canSeePay, session } from "@/lib/supabase/server";
import { loadWorkers } from "./data";

const MAX = 9 * 1024 * 1024;

export async function importExcel(periodId: string, fd: FormData) {
  const { sb, membership } = await session();
  if (!membership || !canSeePay(membership.role)) redirect("/");
  const back = `/periodi/${periodId}`;
  const file = fd.get("file");
  if (!(file instanceof File) || !file.size) redirect(`${back}?e=${encodeURIComponent("Scegli un file Excel.")}`);
  if (file.size > MAX) redirect(`${back}?e=${encodeURIComponent("File troppo grande (massimo 9 MB).")}`);

  const { workers, issues } = await parseWorkbook(await file.arrayBuffer());
  const all: RowIssue[] = [...issues, ...validateWorkers(workers).map(i => ({ row: null, id: i.id, severity: i.severity, message: i.message }))];
  const ok = !all.some(i => i.severity === "errore");

  const { data: imp, error: e1 } = await sb.from("imports").insert({
    org_id: membership.org_id, period_id: periodId, source: "excel", file_name: file.name, row_count: ok ? workers.length : 0, issues: all,
  }).select("id").single();
  if (e1) redirect(`${back}?e=${encodeURIComponent(e1.message)}`);
  if (!ok) redirect(back);

  // Sostituisce i dati del periodo. TODO: rendere atomico con una funzione nel database (prossima migrazione).
  const { error: e2 } = await sb.from("workers").delete().eq("period_id", periodId);
  if (e2) redirect(`${back}?e=${encodeURIComponent(e2.message)}`);
  const rows = workers.map(w => ({
    org_id: membership.org_id, period_id: periodId, import_id: imp.id, employee_code: w.id, full_name: w.fullName ?? null, gender: w.gender,
    category: w.category, funzione: w.funzione, mansione: w.mansione ?? null, sede: w.sede ?? null, area: w.area ?? null, livello: w.livello ?? null,
    fte: w.fte, hours_paid: w.hoursPaid, base_pay: w.basePay, variable_pay: w.variablePay ?? 0, employer_cost: w.employerCost ?? null, seniority_years: w.seniorityYears ?? null,
  }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await sb.from("workers").insert(rows.slice(i, i + 500));
    if (error) redirect(`${back}?e=${encodeURIComponent("Import interrotto: " + error.message)}`);
  }
  redirect(back);
}

export async function saveReport(periodId: string) {
  const { sb, membership } = await session();
  if (!membership || !canSeePay(membership.role)) redirect("/");
  const workers = await loadWorkers(sb, periodId);
  const { error } = await sb.from("pay_reports").insert({ org_id: membership.org_id, period_id: periodId, engine_version: ENGINE_VERSION, payload: payGapReport(workers) });
  redirect(`/periodi/${periodId}${error ? `?e=${encodeURIComponent(error.message)}` : "#report-salvati"}`);
}

export async function finalizeReport(periodId: string, reportId: string) {
  const { sb, membership } = await session();
  if (!membership || !canSeePay(membership.role)) redirect("/");
  const { error } = await sb.from("pay_reports").update({ finalized_at: new Date().toISOString() }).eq("id", reportId).is("finalized_at", null);
  redirect(`/periodi/${periodId}${error ? `?e=${encodeURIComponent(error.message)}` : "#report-salvati"}`);
}
