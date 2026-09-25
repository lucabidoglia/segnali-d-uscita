import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { RiskFactors } from "@g1g10/engine";
import { EvalForm } from "@/components/EvalForm";
import { DEFAULT_FACTORS, MARKET_HOURS } from "@/lib/factors";
import { dtIt, sp } from "@/lib/format";
import { canRisk, session } from "@/lib/supabase/server";
import { loadPeriod, periodMonths } from "../data";
import { loadSignals } from "../segnali/shared";
import { closeRisk, openWithReason, saveAssessment } from "./actions";
import { reasonCookie } from "./reason";

export default async function Valutazione({ params, searchParams }: PageProps<"/periodi/[id]/valutazione">) {
  const { id } = await params;
  const s = await searchParams;
  const w = sp(s.w), e = sp(s.e), m = sp(s.m);
  const { sb, membership } = await session();
  if (!canRisk(membership)) redirect(`/periodi/${id}`);
  const people = await loadSignals(sb, id);
  const period = (await loadPeriod(sb, id))!;
  const msg = <>{e && <p className="rounded-md border border-hi px-3 py-2 text-sm text-hi">{e}</p>}{m && <p className="rounded-md border border-lo px-3 py-2 text-sm text-lo">{m}</p>}</>;

  const picker = (
    <form className="card flex flex-wrap items-end gap-3" action={`/periodi/${id}/valutazione`}>
      <div className="min-w-72 grow"><label className="label" htmlFor="w">Persona</label>
        <select id="w" name="w" className="input" defaultValue={w ?? ""}>
          <option value="">— nessuna (simulazione libera) —</option>
          {people.slice().sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? "")).map(p => (
            <option key={p.worker_id} value={p.worker_id}>{p.full_name ?? p.employee_code} · {p.funzione}</option>
          ))}
        </select></div>
      <button className="btn-sec">Scegli</button>
    </form>
  );

  if (!w) return <div className="space-y-4">{msg}{picker}<EvalForm initial={DEFAULT_FACTORS} ral={30000} /></div>;

  const person = people.find(p => p.worker_id === w);
  if (!person) redirect(`/periodi/${id}/valutazione`);
  const reason = (await cookies()).get(reasonCookie(w))?.value;

  if (!reason) return (
    <div className="space-y-4">
      {msg}{picker}
      <form action={openWithReason.bind(null, id, w)} className="card max-w-2xl space-y-3">
        <h2 className="font-semibold">Aprire il rischio di {person.full_name ?? person.employee_code}</h2>
        <p className="text-sm text-mut">Il punteggio di rischio è un dato personale delicato. Scrivi perché ti serve vederlo: la motivazione, il tuo nome, la data e l&apos;ora restano nel registro accessi, consultabile dal revisore (DPO).</p>
        <div><label className="label" htmlFor="reason">Motivazione</label>
          <input id="reason" name="reason" className="input" required minLength={10} placeholder="Es. preparazione del colloquio di sviluppo del 30/09" /></div>
        <button className="btn">Apri valutazione</button>
      </form>
    </div>
  );

  const { data: opened, error } = await sb.rpc("open_risk", { p_worker: w, p_reason: reason });
  if (error) return <div className="space-y-4">{picker}<p className="rounded-md border border-hi px-3 py-2 text-sm text-hi">{error.message}</p></div>;
  const last = (opened as { factors: RiskFactors; score: number; created_at: string; model_version: string }[])[0];
  const { data: wk } = await sb.from("workers").select("funzione, base_pay, hours_paid").eq("id", w).single();
  const { data: mk } = await sb.from("market_refs").select("annual_pay").eq("period_id", id).eq("funzione", wk?.funzione ?? "").maybeSingle();
  const hourly = wk && +wk.hours_paid > 0 ? +wk.base_pay / +wk.hours_paid : undefined;
  const ral = wk ? (+wk.base_pay * 12) / periodMonths(period) : 30000;

  return (
    <div className="space-y-4">
      {msg}{picker}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span><b>{person.full_name}</b> · [{person.employee_code}] · {person.funzione} · {person.sede}</span>
        <span className="text-mut">{last ? `ultima valutazione ${dtIt(last.created_at)} (modello v${last.model_version})` : "mai valutata: fattori predefiniti"}</span>
        <span className="grow" />
        <Link className="text-brand underline" href={`/periodi/${id}/registro`}>Registro</Link>
        <form action={closeRisk.bind(null, id, w)}><button className="btn-sec">Chiudi</button></form>
      </div>
      <p className="text-xs text-mut">Accesso registrato con motivazione: «{reason}». La visualizzazione resta aperta 15 minuti su questo browser.</p>
      <EvalForm key={last?.created_at ?? "new"} initial={{ ...DEFAULT_FACTORS, ...(last?.factors ?? {}) }} hourly={hourly}
        market={mk ? +mk.annual_pay / MARKET_HOURS : undefined} ral={ral} save={saveAssessment.bind(null, id, w)} />
    </div>
  );
}
