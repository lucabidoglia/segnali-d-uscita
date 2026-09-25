import "server-only";
import type { Client } from "@/lib/supabase/server";

export interface Signal {
  worker_id: string; employee_code: string; full_name: string | null; sede: string | null; area: string | null; funzione: string;
  mansione: string | null; seniority_years: number | null; priority: string | null; assessed: boolean; flag: "auto" | "snooze" | null;
}
export const PRI_ORDER: Record<string, number> = { Critica: 4, Alta: 3, Media: 2, Bassa: 1 };

/** Lista Segnali (solo HR rischio): nomi e priorità, mai il punteggio. */
export async function loadSignals(sb: Client, periodId: string): Promise<Signal[]> {
  const { data, error } = await sb.rpc("risk_list", { p_period: periodId });
  if (error) throw new Error(error.message);
  return (data as Signal[]).map(s => ({ ...s, seniority_years: s.seniority_years === null ? null : Number(s.seniority_years) }));
}
