"use server";
import { redirect } from "next/navigation";
import { MARKET_CHOICES } from "@/lib/benchmarks";
import { MARKET_HOURS } from "@/lib/factors";
import { canSeePay, session } from "@/lib/supabase/server";

/** 3,4 · 3.4 · 35.000 · 35000,50 → numero */
const num = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim().replace(/[€\s]/g, "");
  return Number.parseFloat(s.includes(",") || /^\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, "").replace(",", ".") : s);
};

export async function saveMarket(periodId: string, fd: FormData) {
  const { sb, membership } = await session();
  if (!membership || !canSeePay(membership)) redirect(`/periodi/${periodId}`);
  const riv = Number.isFinite(num(fd.get("riv"))) ? num(fd.get("riv")) : 0;
  const refs: { org_id: string; period_id: string; funzione: string; annual_pay: number }[] = [];
  for (const fn of fd.getAll("fn").map(String)) {
    const choice = String(fd.get(`b:${fn}`) ?? "");
    const manual = num(fd.get(`r:${fn}`));
    const b = MARKET_CHOICES.find(c => c.key === choice);
    // riferimento ufficiale: €/h × 1.730 h (stessa base del confronto), rivalutato della % indicata
    const annual = b ? b.hourly * MARKET_HOURS * (1 + riv / 100) : manual;
    if (Number.isFinite(annual) && annual > 0) refs.push({ org_id: membership.org_id, period_id: periodId, funzione: fn, annual_pay: Math.round(annual) });
  }
  const del = await sb.from("market_refs").delete().eq("period_id", periodId);
  const ins = refs.length ? await sb.from("market_refs").insert(refs) : { error: null };
  const error = del.error ?? ins.error;
  redirect(`/periodi/${periodId}/mercato?${error ? "e=" + encodeURIComponent(error.message) : "m=" + encodeURIComponent(`${refs.length} riferimenti salvati. Punteggi di rischio già salvati non cambiano: si aggiornano alla prossima valutazione.`)}`);
}
