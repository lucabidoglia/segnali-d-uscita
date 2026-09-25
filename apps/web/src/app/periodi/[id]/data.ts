import "server-only";
import { cache } from "react";
import type { Worker } from "@g1g10/engine";
import { MARKET_HOURS } from "@/lib/factors";
import type { Client } from "@/lib/supabase/server";

export interface DbWorker {
  id: string; employee_code: string; full_name: string | null; gender: "F" | "M" | "ND"; category: string; funzione: string;
  mansione: string | null; sede: string | null; area: string | null; livello: string | null; fte: number; hours_paid: number;
  base_pay: number; variable_pay: number; employer_cost: number | null; seniority_years: number | null;
  training_title: string | null; training_hours: number | null; training_start: string | null;
}
const COLS = "id, employee_code, full_name, gender, category, funzione, mansione, sede, area, livello, fte, hours_paid, base_pay, variable_pay, employer_cost, seniority_years, training_title, training_hours, training_start";
const NUMS = ["fte", "hours_paid", "base_pay", "variable_pay", "employer_cost", "seniority_years", "training_hours"] as const;

/** Tutti i lavoratori del periodo (le regole RLS limitano a HR/admin), con i numeri già convertiti. */
export async function loadDbWorkers(sb: Client, periodId: string): Promise<DbWorker[]> {
  const out: DbWorker[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from("workers").select(COLS).eq("period_id", periodId).order("full_name").order("employee_code").range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const r of data as Record<string, unknown>[]) {
      for (const k of NUMS) if (r[k] !== null) r[k] = Number(r[k]);
      out.push(r as unknown as DbWorker);
    }
    if (data.length < 1000) return out;
  }
}

export const toEngine = (w: DbWorker): Worker => ({
  id: w.employee_code, gender: w.gender, category: w.category, funzione: w.funzione, fte: w.fte,
  hoursPaid: w.hours_paid, basePay: w.base_pay, variablePay: w.variable_pay,
});

export async function loadWorkers(sb: Client, periodId: string): Promise<Worker[]> {
  return (await loadDbWorkers(sb, periodId)).map(toEngine);
}

/** Retribuzione oraria totale (base + variabile): base del divario (Dir. 2023/970). */
export const hourly = (w: Pick<DbWorker, "base_pay" | "variable_pay" | "hours_paid">) => (w.hours_paid > 0 ? (w.base_pay + w.variable_pay) / w.hours_paid : 0);
/** Retribuzione di base oraria: si confronta con la RAL di mercato nel motore di rischio. */
export const baseHourly = (w: Pick<DbWorker, "base_pay" | "hours_paid">) => (w.hours_paid > 0 ? w.base_pay / w.hours_paid : 0);

/** Mercato orario per funzione (RAL media di mercato ÷ 1.730 h). */
export async function loadMarket(sb: Client, periodId: string): Promise<Map<string, number>> {
  const { data } = await sb.from("market_refs").select("funzione, annual_pay").eq("period_id", periodId);
  return new Map((data ?? []).map(m => [m.funzione, Number(m.annual_pay) / MARKET_HOURS]));
}

export interface Period { id: string; label: string; starts_on: string; ends_on: string }
export const loadPeriod = cache(async (sb: Client, id: string): Promise<Period | null> =>
  (await sb.from("periods").select("id, label, starts_on, ends_on").eq("id", id).maybeSingle()).data);

/** Mesi coperti dal periodo (per annualizzare gli importi). */
export const periodMonths = (p: Period) => Math.max(1, Math.round(((+new Date(p.ends_on) - +new Date(p.starts_on)) / 864e5 + 1) / 30.44));
