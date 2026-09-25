import "server-only";
import type { Worker } from "@g1g10/engine";
import type { supabase } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof supabase>>;

/** Legge i lavoratori del periodo (le regole RLS limitano a HR/admin) e li converte nel formato del motore. */
export async function loadWorkers(sb: Client, periodId: string): Promise<Worker[]> {
  const out: Worker[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from("workers")
      .select("employee_code, gender, category, funzione, fte, hours_paid, base_pay, variable_pay")
      .eq("period_id", periodId).order("employee_code").range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...data.map(r => ({
      id: r.employee_code, gender: r.gender, category: r.category, funzione: r.funzione, fte: Number(r.fte),
      hoursPaid: Number(r.hours_paid), basePay: Number(r.base_pay), variablePay: Number(r.variable_pay),
    })));
    if (data.length < 1000) return out;
  }
}
