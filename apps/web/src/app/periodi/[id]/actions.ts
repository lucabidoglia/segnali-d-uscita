"use server";
import { redirect } from "next/navigation";
import { computeRisk, ENGINE_VERSION, payGapReport, validateWorkers, RISK_MODEL_V1 } from "@g1g10/engine";
import { parseWorkbook, type RowIssue } from "@/lib/excel";
import { MARKET_HOURS } from "@/lib/factors";
import { canRisk, canSeePay, session } from "@/lib/supabase/server";
import { baseHourly, loadWorkers } from "./data";

const MAX = 9 * 1024 * 1024;
const fail = (back: string, msg: string) => redirect(`${back}?e=${encodeURIComponent(msg)}`);

export async function importExcel(periodId: string, fd: FormData) {
  const { sb, membership } = await session();
  if (!membership || !canSeePay(membership)) redirect("/");
  const back = `/periodi/${periodId}`;
  const file = fd.get("file");
  if (!(file instanceof File) || !file.size) fail(back, "Scegli un file Excel.");
  if ((file as File).size > MAX) fail(back, "File troppo grande (massimo 9 MB).");

  const { workers, factors, market, issues } = await parseWorkbook(await (file as File).arrayBuffer());
  const all: RowIssue[] = [...issues, ...validateWorkers(workers).map(i => ({ row: null, id: i.id, severity: i.severity, message: i.message }))];
  const risk = canRisk(membership);
  if (factors.size && !risk) all.push({ row: null, id: null, severity: "avviso", sheet: "Fattori rischio", message: "Foglio ignorato: solo chi ha il ruolo HR rischio può caricare i fattori di rischio." });
  const name = (file as File).name;

  if (all.some(i => i.severity === "errore")) {
    // tentativo scartato: resta traccia nel registro import, nessun dato caricato
    await sb.from("imports").insert({ org_id: membership.org_id, period_id: periodId, source: "excel", file_name: name, row_count: 0, issues: all });
    redirect(back);
  }

  const rows = workers.map(w => ({
    employee_code: w.id, full_name: w.fullName ?? null, gender: w.gender, category: w.category, funzione: w.funzione, mansione: w.mansione ?? null,
    sede: w.sede ?? null, area: w.area ?? null, livello: w.livello ?? null, fte: w.fte, hours_paid: w.hoursPaid, base_pay: w.basePay,
    variable_pay: w.variablePay ?? 0, employer_cost: w.employerCost ?? null, seniority_years: w.seniorityYears ?? null,
    training_title: w.trainingTitle ?? null, training_hours: w.trainingHours ?? null, training_start: w.trainingStart ?? null,
  }));
  const { error } = await sb.rpc("import_period", { p_period: periodId, p_file_name: name, p_issues: all, p_workers: rows, p_market: market });
  if (error) fail(back, "Import non riuscito, nessun dato modificato: " + error.message);

  if (risk && factors.size) {
    const { data: ids } = await sb.from("workers").select("id, employee_code, funzione, base_pay, hours_paid").eq("period_id", periodId);
    const mk = new Map(market.map(m => [m.funzione, m.annual_pay / MARKET_HOURS]));
    const assessments = (ids ?? []).filter(w => factors.has(w.employee_code)).map(w => {
      const f = factors.get(w.employee_code)!;
      const r = computeRisk(f, baseHourly({ base_pay: +w.base_pay, hours_paid: +w.hours_paid }), mk.get(w.funzione));
      return { org_id: membership.org_id, worker_id: w.id, model_version: RISK_MODEL_V1.version, factors: f, score: r.score, level: r.level, priority: r.priority, drivers: r.drivers };
    });
    for (let i = 0; i < assessments.length; i += 500) {
      const { error: e } = await sb.from("risk_assessments").insert(assessments.slice(i, i + 500));
      if (e) fail(back, "Dati caricati, ma i fattori di rischio no: " + e.message);
    }
  }
  redirect(back);
}

export async function saveReport(periodId: string) {
  const { sb, membership } = await session();
  if (!membership || !canSeePay(membership)) redirect("/");
  const workers = await loadWorkers(sb, periodId);
  const { error } = await sb.from("pay_reports").insert({ org_id: membership.org_id, period_id: periodId, engine_version: ENGINE_VERSION, payload: payGapReport(workers) });
  redirect(`/periodi/${periodId}${error ? `?e=${encodeURIComponent(error.message)}` : "#report-salvati"}`);
}

export async function finalizeReport(periodId: string, reportId: string) {
  const { sb, membership } = await session();
  if (!membership || !canSeePay(membership)) redirect("/");
  const { error } = await sb.from("pay_reports").update({ finalized_at: new Date().toISOString() }).eq("id", reportId).is("finalized_at", null);
  redirect(`/periodi/${periodId}${error ? `?e=${encodeURIComponent(error.message)}` : "#report-salvati"}`);
}
