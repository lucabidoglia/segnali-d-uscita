import Link from "next/link";
import { gapPct } from "@g1g10/engine";
import { BENCH, DIMENSIONS, table } from "@/lib/benchmarks";
import { eur0, eur2, pc, sp } from "@/lib/format";

const UNIT: Record<string, string> = { orario: "€ / ora lorda", annuo: "€ / anno lordi", "minimo mensile": "€ / mese lordi (minimo)", "paga base mensile": "€ / mese lordi (paga base)" };
const fmt = (m: string, v?: number) => (v === undefined ? "—" : m === "orario" ? eur2(v) : m.includes("mensile") ? eur2(v) : eur0(v));

export default async function Mercato({ searchParams }: PageProps<"/mercato">) {
  const s = await searchParams;
  const dim = sp(s.d) && DIMENSIONS.includes(sp(s.d)!) ? sp(s.d)! : "Area geografica";
  const combos = [...new Set(BENCH.rows.filter(r => r.dimension === dim).map(r => `${r.source}|${r.measure}`))];
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Medie di mercato</h1>
        <p className="text-sm text-mut">Solo fonti ufficiali o contrattuali, con anno e metodo. Servono come riferimento orientativo: non sostituiscono una pesatura delle posizioni né un&apos;indagine retributiva di settore.</p>
      </div>
      <nav className="flex flex-wrap gap-1.5" aria-label="Dimensioni">
        {DIMENSIONS.map(d => (
          <Link key={d} href={`/mercato?d=${encodeURIComponent(d)}`} className={`rounded-full border px-3 py-1 text-sm ${d === dim ? "border-brand bg-brand text-brand-fg" : "border-line hover:bg-bg"}`}>{d}</Link>
        ))}
      </nav>
      {combos.map(c => {
        const [src, measure] = c.split("|") as [string, string];
        const rows = table(dim, measure, src), S = BENCH.sources[src]!;
        const hasSex = rows.some(r => r.F !== undefined);
        return (
          <div key={c} className="card overflow-x-auto p-0">
            <div className="px-5 pt-4">
              <h2 className="font-semibold">{dim} <span className="text-sm font-normal text-mut">· {UNIT[measure] ?? measure}</span></h2>
              <p className="text-xs text-mut">Fonte: <a className="underline" href={S.url} target="_blank" rel="noopener">{S.name}</a> · {S.note}</p>
            </div>
            <table className="tbl mt-2"><thead><tr><th>Gruppo</th>{hasSex && <><th className="num">Donne</th><th className="num">Uomini</th></>}<th className="num">Totale</th>{hasSex && <th className="num">Divario</th>}{rows.some(r => r.days) && <th className="num">Giornate retribuite</th>}</tr></thead>
              <tbody>{rows.map(r => {
                const g = r.F !== undefined && r.M !== undefined ? gapPct(r.F, r.M) : null;
                return (
                  <tr key={r.group}><td>{r.group}</td>
                    {hasSex && <><td className="num">{fmt(measure, r.F)}</td><td className="num">{fmt(measure, r.M)}</td></>}
                    <td className="num font-medium">{fmt(measure, r.T)}</td>
                    {hasSex && <td className={`num ${g !== null && Math.abs(g) >= 5 ? "text-hi" : "text-mut"}`}>{pc(g)}</td>}
                    {rows.some(x => x.days) && <td className="num text-mut">{r.days ?? ""}</td>}
                  </tr>
                );
              })}</tbody></table>
          </div>
        );
      })}
      <p className="note">Divario = (uomini − donne) ÷ uomini. Aggiornamento: <code>node scripts/make-benchmarks.mjs</code> (ultimo {BENCH.generated}). Per confrontare la tua azienda usa la scheda «Mercato» di un periodo, che assegna a ogni funzione un riferimento.</p>
    </div>
  );
}
