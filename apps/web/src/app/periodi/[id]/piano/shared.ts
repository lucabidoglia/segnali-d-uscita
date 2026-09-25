import "server-only";
import { mean, payGapReport, type PayGapReport } from "@g1g10/engine";
import { buildPlan, type Action, type RiskAgg, type RiskGroupAgg } from "@/lib/actionPlan";
import { canSeePay, type Client, type Membership } from "@/lib/supabase/server";
import { baseHourly, loadDbWorkers, loadMarket } from "../data";

export interface ActionState { status: "Da fare" | "In corso" | "Fatto" | "Non applicabile"; owner: string | null; due_on: string | null; note: string | null; updated_at: string }
export type PlannedAction = Action & { state: ActionState | null; dueEff: string; late: boolean };

/** Raccoglie i dati del periodo (nel rispetto dei ruoli), genera il piano e lo unisce a quanto salvato dalle persone. */
export async function loadPlan(sb: Client, m: Membership, periodId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const pay = canSeePay(m);
  let gap: PayGapReport | null = null, belowMarket: { funzione: string; dev: number; persone: number }[] = [], marketMissing = false;
  if (pay) {
    const ws = await loadDbWorkers(sb, periodId);
    if (ws.length) {
      gap = payGapReport(ws.map(w => ({ id: w.employee_code, gender: w.gender, category: w.category, funzione: w.funzione, fte: w.fte, hoursPaid: w.hours_paid, basePay: w.base_pay, variablePay: w.variable_pay })));
      const mk = await loadMarket(sb, periodId);
      marketMissing = mk.size === 0;
      belowMarket = [...new Set(ws.map(w => w.funzione))].flatMap(fn => {
        const list = ws.filter(w => w.funzione === fn), ref = mk.get(fn);
        return ref ? [{ funzione: fn, dev: ((mean(list.map(baseHourly)) - ref) / ref) * 100, persone: list.length }] : [];
      });
    }
  } else {
    gap = ((await sb.from("pay_reports").select("payload").eq("period_id", periodId).order("created_at", { ascending: false }).limit(1).maybeSingle()).data?.payload as PayGapReport) ?? null;
  }
  const risk = ((await sb.rpc("risk_overview", { p_period: periodId })).data as RiskAgg | null) ?? null;
  const riskGroups = (((await sb.rpc("risk_groups", { p_period: periodId })).data ?? []) as RiskGroupAgg[]);
  const { count } = await sb.from("pay_reports").select("id", { count: "exact", head: true }).eq("period_id", periodId).not("finalized_at", "is", null);
  const headcount = gap?.headcount ?? risk?.persone ?? 0;

  const actions = buildPlan({ today, headcount, gap, risk: risk && risk.valutate ? risk : null, riskGroups, belowMarket, marketMissing, hasFinalReport: (count ?? 0) > 0 });
  const { data: saved } = await sb.from("action_items").select("key, status, owner, due_on, note, updated_at").eq("period_id", periodId);
  const byKey = new Map((saved ?? []).map(s => [s.key, s as ActionState & { key: string }]));
  const planned: PlannedAction[] = actions.map(a => {
    const state = byKey.get(a.key) ?? null, dueEff = state?.due_on ?? a.due;
    return { ...a, state, dueEff, late: dueEff < today && !["Fatto", "Non applicabile"].includes(state?.status ?? "Da fare") };
  });
  return { today, planned, headcount, pay };
}
