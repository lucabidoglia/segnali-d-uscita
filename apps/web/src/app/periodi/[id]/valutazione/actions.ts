"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { computeRisk, RISK_MODEL_V1, type RiskFactors } from "@g1g10/engine";
import { FACTORS, MARKET_HOURS } from "@/lib/factors";
import { canRisk, session } from "@/lib/supabase/server";
import { reasonCookie } from "./reason";


/** Registra la motivazione per aprire il rischio di UNA persona (valida 15 minuti su questo browser). */
export async function openWithReason(periodId: string, workerId: string, fd: FormData) {
  const reason = String(fd.get("reason") ?? "").trim();
  const back = `/periodi/${periodId}/valutazione?w=${workerId}`;
  if (reason.length < 10) redirect(`${back}&e=${encodeURIComponent("Scrivi una motivazione di almeno 10 caratteri.")}`);
  (await cookies()).set(reasonCookie(workerId), reason, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", maxAge: 900, path: "/periodi" });
  redirect(back);
}

export async function closeRisk(periodId: string, workerId: string) {
  (await cookies()).delete({ name: reasonCookie(workerId), path: "/periodi" });
  redirect(`/periodi/${periodId}/valutazione`);
}

function readFactors(fd: FormData): RiskFactors {
  const f: Record<string, number> = {};
  for (const d of FACTORS) {
    const v = Number(fd.get(d.key));
    if (!d.opts.some(o => o[0] === v)) throw new Error(`Valore non valido per ${d.head}`);
    f[d.key] = v;
  }
  // retribuzione manuale: solo quando manca il riferimento di mercato
  if (fd.has("comp")) f.comp = [0, 5, 12, 18].includes(Number(fd.get("comp"))) ? Number(fd.get("comp")) : 0;
  return f as unknown as RiskFactors;
}

/** Salva una nuova valutazione (le precedenti restano nello storico). Il punteggio è ricalcolato qui, non preso dal browser. */
export async function saveAssessment(periodId: string, workerId: string, fd: FormData) {
  const { sb, membership } = await session();
  if (!membership || !canRisk(membership)) redirect(`/periodi/${periodId}`);
  const f = readFactors(fd);
  const { data: w } = await sb.from("workers").select("funzione, base_pay, hours_paid").eq("id", workerId).single();
  const { data: mk } = await sb.from("market_refs").select("annual_pay").eq("period_id", periodId).eq("funzione", w?.funzione ?? "").maybeSingle();
  const hourly = w && +w.hours_paid > 0 ? +w.base_pay / +w.hours_paid : undefined;
  const r = computeRisk(f, hourly, mk ? +mk.annual_pay / MARKET_HOURS : undefined);
  const { error } = await sb.from("risk_assessments").insert({ org_id: membership.org_id, worker_id: workerId, model_version: RISK_MODEL_V1.version, factors: f, score: r.score, level: r.level, priority: r.priority, drivers: r.drivers });
  const note = String(fd.get("note") ?? "").trim();
  if (!error && fd.get("openCase")) await sb.from("cases").insert({ org_id: membership.org_id, worker_id: workerId, priority: r.priority, note: note || `Driver: ${r.drivers.slice(0, 3).map(d => d.label).join(", ")}.` });
  redirect(`/periodi/${periodId}/valutazione?w=${workerId}&${error ? "e=" + encodeURIComponent(error.message) : "m=" + encodeURIComponent(fd.get("openCase") ? "Valutazione salvata e caso aperto nel Registro" : "Valutazione salvata")}`);
}
