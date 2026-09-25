import Link from "next/link";
import { Crumb } from "@/components/Crumb";
import { eur0, eur2, pc, sp } from "@/lib/format";
import { canRisk, session } from "@/lib/supabase/server";
import { loadSignals } from "../segnali/shared";

interface Group { grp: string; persone: number; valutate: number; visibile: boolean; rischio_medio: number | null; rischio_alto: number | null; critiche: number | null; orario_medio: number | null; mercato_orario: number | null; costo_a_rischio: number | null }
const lvl = (s: number) => (s >= 70 ? "hi" : s >= 40 ? "mid" : "lo");

export default async function Funzioni({ params, searchParams }: PageProps<"/periodi/[id]/funzioni">) {
  const { id } = await params;
  const s = await searchParams;
  const area = sp(s.area), fn = sp(s.fn);
  const { sb, membership } = await session();
  const risk = canRisk(membership);
  const base = `/periodi/${id}/funzioni`;

  if (area && fn) {
    if (!risk) return <div className="space-y-4"><Crumb base={base} area={area} fn={fn} /><p className="note">Il dettaglio per persona è riservato al ruolo HR rischio.</p></div>;
    const people = (await loadSignals(sb, id)).filter(p => (p.area ?? "—") === area && p.funzione === fn);
    return (
      <div className="space-y-4">
        <Crumb base={base} area={area} fn={fn} />
        <p className="note">{fn} — {area} · {people.length} persone. Il punteggio individuale si apre da «Valuta», con motivazione.</p>
        <div className="card overflow-x-auto p-0">
          <table className="tbl"><thead><tr><th>Persona</th><th>Struttura</th><th>Mansione</th><th className="num">Anz.</th><th>Priorità</th><th /></tr></thead>
            <tbody>{people.map(p => (
              <tr key={p.worker_id}><td><b>[{p.employee_code}]</b> {p.full_name}</td><td>{p.sede}</td><td className="text-mut">{p.mansione}</td>
                <td className="num">{p.seniority_years !== null ? `${p.seniority_years.toLocaleString("it-IT")} a` : ""}</td>
                <td>{p.priority ?? <span className="text-mut">Non valutata</span>}</td>
                <td className="num"><Link className="text-brand underline" href={`/periodi/${id}/valutazione?w=${p.worker_id}`}>Valuta</Link></td></tr>
            ))}</tbody></table>
        </div>
      </div>
    );
  }

  const { data, error } = await sb.rpc("risk_groups", { p_period: id, p_area: area ?? null });
  const groups = (data ?? []) as Group[];
  const clickable = !area || risk;
  return (
    <div className="space-y-4">
      <Crumb base={base} area={area} />
      <p className="note">Rischio medio e scostamento della retribuzione di base dal mercato (RAL media di mercato ÷ 1.730 h, dal foglio «Mercato»). I gruppi con meno di 5 persone mostrano solo il numero di persone.{clickable ? " Clicca una riga per scendere di livello." : ""}</p>
      {error && <p className="text-sm text-hi">{error.message}</p>}
      <div className="card overflow-x-auto p-0">
        <table className="tbl"><thead><tr>
          <th>{area ? "Funzione" : "Area"}</th><th className="num">Persone</th><th className="num">Valutate</th><th className="num">Rischio medio</th><th className="num">Rischio alto</th>
          <th className="num">€/h base</th><th className="num">€/h mercato</th><th className="num">Scostamento</th><th className="num">Costo a rischio</th>
        </tr></thead>
          <tbody>{groups.map(g => {
            const dev = g.orario_medio && g.mercato_orario ? ((g.orario_medio - g.mercato_orario) / g.mercato_orario) * 100 : null;
            const href = area ? `${base}?area=${encodeURIComponent(area)}&fn=${encodeURIComponent(g.grp)}` : `${base}?area=${encodeURIComponent(g.grp)}`;
            return (
              <tr key={g.grp}>
                <td className="font-medium">{clickable ? <Link className="hover:underline" href={href}>{g.grp} ›</Link> : g.grp}</td>
                <td className="num">{g.persone}</td><td className="num">{g.valutate}</td>
                {g.visibile ? <>
                  <td className="num">{g.rischio_medio !== null ? <b style={{ color: `var(--${lvl(Number(g.rischio_medio))})` }}>{Math.round(Number(g.rischio_medio))}</b> : "—"}</td>
                  <td className="num">{g.rischio_alto}</td>
                  <td className="num">{g.orario_medio !== null ? eur2(Number(g.orario_medio)) : "—"}</td>
                  <td className="num">{g.mercato_orario !== null ? eur2(Number(g.mercato_orario)) : "—"}</td>
                  <td className="num" style={{ color: `var(--${dev === null ? "mut" : dev < -7 ? "hi" : dev > 7 ? "lo" : "mut"})` }}>{pc(dev)}</td>
                  <td className="num">€ {eur0(Number(g.costo_a_rischio ?? 0))}</td>
                </> : <td colSpan={6} className="text-xs text-mut">Gruppo piccolo: dati non mostrati per tutela delle persone</td>}
              </tr>
            );
          })}</tbody></table>
        {!groups.length && <p className="p-5 text-sm text-mut">Nessun dato per questo periodo.</p>}
      </div>
    </div>
  );
}
