import Link from "next/link";
import { redirect } from "next/navigation";
import { mean } from "@g1g10/engine";
import { MARKET_CHOICES } from "@/lib/benchmarks";
import { MARKET_HOURS } from "@/lib/factors";
import { eur0, eur2, pc, sp } from "@/lib/format";
import { canSeePay, session } from "@/lib/supabase/server";
import { baseHourly, loadDbWorkers } from "../data";
import { saveMarket } from "./actions";

export default async function MercatoPeriodo({ params, searchParams }: PageProps<"/periodi/[id]/mercato">) {
  const { id } = await params;
  const s = await searchParams;
  const e = sp(s.e), m = sp(s.m);
  const { sb, membership } = await session();
  if (!canSeePay(membership)) redirect(`/periodi/${id}`);
  const ws = await loadDbWorkers(sb, id);
  const { data: refs } = await sb.from("market_refs").select("funzione, annual_pay").eq("period_id", id);
  const cur = new Map((refs ?? []).map(r => [r.funzione, Number(r.annual_pay)]));
  const fns = [...new Set(ws.map(w => w.funzione))].sort();

  return (
    <form action={saveMarket.bind(null, id)} className="space-y-4">
      {e && <p className="rounded-md border border-hi px-3 py-2 text-sm text-hi">{e}</p>}
      {m && <p className="rounded-md border border-lo px-3 py-2 text-sm text-lo">{m}</p>}
      <p className="note">
        Per ogni funzione scegli un riferimento dalle <Link className="underline" href="/mercato">medie di mercato ufficiali</Link> (Eurostat 2022, professione × dimensione azienda, €/h × 1.730 h)
        oppure scrivi una RAL di mercato (es. da un&apos;indagine retributiva di settore). Il confronto usa la retribuzione di <b>base</b> oraria delle persone.
      </p>
      <div className="card flex flex-wrap items-end gap-3">
        <div><label className="label" htmlFor="riv">Rivalutazione dei dati Eurostat 2022 (%)</label><input id="riv" name="riv" className="input w-40" defaultValue="0" inputMode="decimal" /></div>
        <p className="max-w-xl text-xs text-mut">I dati ufficiali più recenti per professione sono del 2022. Per portarli al periodo puoi applicare una crescita: ad esempio INPS registra +3,4% delle retribuzioni medie nel 2024 sul 2023. Scegli il valore con il consulente del lavoro.</p>
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="tbl"><thead><tr><th>Funzione</th><th className="num">Persone</th><th className="num">€/h base azienda</th><th className="num">RAL mercato attuale</th><th className="num">Scostamento</th><th>Riferimento ufficiale</th><th>oppure RAL €</th></tr></thead>
          <tbody>{fns.map(fn => {
            const list = ws.filter(w => w.funzione === fn), h = mean(list.map(baseHourly)), ral = cur.get(fn), mh = ral ? ral / MARKET_HOURS : null;
            return (
              <tr key={fn}>
                <td className="font-medium"><input type="hidden" name="fn" value={fn} />{fn}</td>
                <td className="num">{list.length}</td><td className="num">{eur2(h)}</td>
                <td className="num">{ral ? `€ ${eur0(ral)}` : <span className="text-mut">—</span>}</td>
                <td className="num" style={mh ? { color: `var(--${(h - mh) / mh * 100 < -7 ? "hi" : (h - mh) / mh * 100 > 7 ? "lo" : "mut"})` } : undefined}>{mh ? pc(((h - mh) / mh) * 100) : ""}</td>
                <td><select name={`b:${fn}`} className="input min-w-72 py-1" defaultValue="">
                  <option value="">— mantieni / usa la RAL a destra —</option>
                  {MARKET_CHOICES.map(c => <option key={c.key} value={c.key}>{c.label} · {eur2(c.hourly)} €/h</option>)}
                </select></td>
                <td><input name={`r:${fn}`} className="input w-32 py-1" inputMode="decimal" defaultValue={ral ? String(ral) : ""} aria-label={`RAL di mercato ${fn}`} /></td>
              </tr>
            );
          })}</tbody></table>
        {!fns.length && <p className="p-5 text-sm text-mut">Nessun dato: carica il file Excel in «Dati & report Direttiva».</p>}
      </div>
      {fns.length > 0 && <button className="btn">Salva riferimenti</button>}
    </form>
  );
}
