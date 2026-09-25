import "server-only";
import type { Client } from "@/lib/supabase/server";

export interface CaseRow { id: string; created_at: string; updated_at: string; status: string; priority: string; note: string | null; worker_id: string; workers: { employee_code: string; full_name: string | null; funzione: string; period_id: string } }

export async function loadCases(sb: Client, periodId: string): Promise<CaseRow[]> {
  const { data, error } = await sb.from("cases")
    .select("id, created_at, updated_at, status, priority, note, worker_id, workers!inner(employee_code, full_name, funzione, period_id)")
    .eq("workers.period_id", periodId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data as unknown as CaseRow[];
}
