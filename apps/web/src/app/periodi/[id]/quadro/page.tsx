import Link from "next/link";
import { payGapReport, type PayGapReport } from "@g1g10/engine";
import { eur2, pc } from "@/lib/format";
import { canRisk, canSeePay, session } from "@/lib/supabase/server";
import { loadWorkers } from "../data";

interface Overview { persone: number; valutate: number; rischio_medio: number | null; rischio_alto: number; critiche: number; costo_a_rischio: number; fasce: number[]; per_sede: { sede: string; persone: number; rischio_medio: number }[] }

function Kpi({ k, v, tone }: { k: string; v: React.ReactNode; tone?: "bad" | "ok" }) {
  return <div className="card py-3"><div className="text-xs text-mut">{k}</div><div className={`text-2xl font-semibold ${tone === "bad" ? "text-hi" : tone === "ok" ? "text-lo" : ""}`}>{v}</div></div>;
}

/** Divario medio a parità di categoria, pesato per numero di persone (come il prototipo). */
const adjusted = (r: PayGapReport) => {
  const c = r.categories.filter(x => x.gapMean !== null);
  const w = c.reduce((s, x) => s + x.n.F + x.n.M, 0);
  return w ? c.reduce((s, x) => s + x.gapMean! * (x.n.F + x.n.M), 0) / w : null;
};

export default async function Quadro({ params }: PageProps<"/periodi/[id]/quadro">) {
  const { id } = await params;
  const { sb, membership } = await session();
  const pay = canSeePay(membership), risk = canRisk(membership);
  const { data: ov } = await sb.rpc("risk_overview", { p_period: id });
  const o = ov as Overview | null;

  let gap: PayGapReport | null = null;
  if (pay) { const ws = await loadWorkers(sb, id); gap = ws.length ? payGapReport(ws) : null; }
  else gap = ((await sb.from("pay_reports").select("payload").eq("period_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle()).data?.payload as PayGapReport) ?? null;

  const crit = risk ? ((await sb.rpc("risk_list", { p_period: id })).data ?? []).filter((r: { priority: string | null }) => r.priority === "Critica").slice(0, 8) : [];
  const n = o?.persone ?? 0, mx = Math.max(1, ...(o?.fasce ?? [0])), adj = gap ? adjusted(gap) : null;
  const tone = (v: number | null) => (v === null ? undefined : Math.abs(v) > 5 ? "bad" : "ok");

  return (
    <div className="space-y-5">
      <p className="note">Dati aggregati: nessun punteggio individuale. {o && o.valutate < o.persone && `Valutate ${o.valutate} persone su ${o.persone}: il rischio considera solo le persone valutate.`}</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi k="Organico" v={n} />
        <Kpi k="Rischio alto" v={<>{o?.rischio_alto ?? 0} <small className="text-sm">({n ? Math.round(((o?.rischio_alto ?? 0) / n) * 100) : 0}%)</small></>} tone="bad" />
        <Kpi k="Priorità critiche" v={o?.critiche ?? 0} tone="bad" />
        <Kpi k="Costo a rischio" v={<>€ {eur2((o?.costo_a_rischio ?? 0) / 1e6)}<small className="text-sm"> M</small></>} />
        <Kpi k="Punteggio medio" v={o?.rischio_medio !== null && o?.rischio_medio !== undefined ? Math.round(o.rischio_medio) : "—"} />
        <Kpi k="Quota femminile" v={gap ? `${Math.round((gap.counted.F / Math.max(1, gap.counted.F + gap.counted.M)) * 100)}%` : "—"} />
        <Kpi k="Divario retributivo" v={pc(gap?.gapMean)} tone={tone(gap?.gapMean ?? null)} />
        <Kpi k="Divario a pari categoria" v={pc(adj)} tone={tone(adj)} />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="card">
          <h2 className="font-semibold">Distribuzione del rischio <span className="text-sm font-normal text-mut">persone per fascia di punteggio</span></h2>
          <div className="mt-4 flex h-40 items-end gap-1.5">
            {(o?.fasce ?? Array(10).fill(0)).map((c, i) => (
              <div key={i} className="flex h-full flex-1 flex-col items-center justify-end text-xs text-mut">
                {c}<i className="mt-1 block w-full rounded-t" style={{ height: `${(c / mx) * 100}%`, background: `var(--${i >= 7 ? "hi" : i >= 4 ? "mid" : "lo"})` }} />
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-xs text-mut"><span>0</span><span>50</span><span>100</span></div>
        </div>
        <div className="card">
          <h2 className="font-semibold">Rischio medio per sede</h2>
          <div className="mt-3 space-y-2">
            {(o?.per_sede ?? []).map(s => (
              <div key={s.sede} className="grid grid-cols-[1fr_2fr_auto] items-center gap-3 text-sm">
                <span className="truncate">{s.sede}</span>
                <span className="h-2.5 rounded bg-bg"><i className="block h-full rounded bg-brand" style={{ width: `${s.rischio_medio}%` }} /></span>
                <b className="tabular-nums">{Math.round(s.rischio_medio)}</b>
              </div>
            ))}
            {!o?.per_sede?.length && <p className="text-sm text-mut">Nessuna sede con almeno 5 persone valutate.</p>}
          </div>
        </div>
      </div>

      {risk && (
        <div className="card p-0">
          <h2 className="px-5 pt-4 font-semibold">Da guardare per prime <span className="text-sm font-normal text-mut">priorità critica · il punteggio si apre solo con motivazione</span></h2>
          {crit.length ? (
            <table className="tbl mt-2"><tbody>{crit.map((p: { worker_id: string; employee_code: string; full_name: string | null; sede: string | null; funzione: string }) => (
              <tr key={p.worker_id}><td><b>[{p.employee_code}]</b> {p.full_name ?? ""}</td><td>{p.sede}</td><td className="text-mut">{p.funzione}</td>
                <td className="num"><Link className="text-brand underline" href={`/periodi/${id}/valutazione?w=${p.worker_id}`}>Apri valutazione</Link></td></tr>
            ))}</tbody></table>
          ) : <p className="px-5 pb-4 pt-2 text-sm text-mut">Nessuna priorità critica.</p>}
        </div>
      )}
      {!o?.valutate && <p className="note">Nessuna valutazione di rischio: carica il foglio «Fattori rischio» nel file Excel (ruolo HR rischio) oppure valuta le persone da Valutazione.</p>}
    </div>
  );
}
