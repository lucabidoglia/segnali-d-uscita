import Link from "next/link";
import { redirect } from "next/navigation";
import { gapPct, mean } from "@g1g10/engine";
import { Crumb } from "@/components/Crumb";
import { eur2, pc, sp } from "@/lib/format";
import { canSeePay, session } from "@/lib/supabase/server";
import { baseHourly, loadDbWorkers, loadMarket, type DbWorker } from "../data";

// livello retributivo = elementi fissi e continuativi (D.Lgs. 96/2026, art. 3 lett. b)
const hourly = baseHourly;

const MIN = 3;
function stats(list: DbWorker[]) {
  const F = list.filter(p => p.gender === "F").map(hourly), M = list.filter(p => p.gender === "M").map(hourly);
  const ok = F.length >= MIN && M.length >= MIN;
  return { nF: F.length, nM: M.length, mF: ok ? mean(F) : null, mM: ok ? mean(M) : null, gap: ok ? gapPct(mean(F), mean(M)) : null, all: mean(list.map(hourly)) };
}
const colDev = (d: number) => ({ color: `var(--${d < -7 ? "hi" : d > 7 ? "lo" : "mut"})` });

export default async function Equita({ params, searchParams }: PageProps<"/periodi/[id]/equita">) {
  const { id } = await params;
  const s = await searchParams;
  const area = sp(s.area), fn = sp(s.fn);
  const { sb, membership } = await session();
  if (!canSeePay(membership)) redirect(`/periodi/${id}`);
  const base = `/periodi/${id}/equita`;
  const all = await loadDbWorkers(sb, id);
  const list = all.filter(p => (!area || (p.area ?? "—") === area) && (!fn || p.funzione === fn));
  const intro = <p className="note">Divario del livello retributivo orario medio (solo elementi fissi e continuativi, D.Lgs. 96/2026 art. 3): (uomini − donne) ÷ uomini. Positivo = donne pagate meno. Soglia di attenzione <b>5%</b> (art. 10). Sotto {MIN} persone per genere il dato non viene mostrato. Clicca una riga per scendere fino alla singola persona.</p>;

  if (area && fn) {
    const g = stats(list), mk = await loadMarket(sb, id);
    const rows = list.slice().sort((a, b) => hourly(a) - hourly(b));
    return (
      <div className="space-y-4">
        <Crumb base={base} area={area} fn={fn} />{intro}
        <p className="note">{fn} — {area} · {list.length} persone · donne {g.nF} · uomini {g.nM} · divario {g.gap !== null ? pc(g.gap) : "n.d. (campione ridotto)"}</p>
        <div className="card overflow-x-auto p-0">
          <table className="tbl"><thead><tr><th>Persona</th><th>Genere</th><th>Struttura</th><th>Mansione</th><th>Livello</th><th className="num">Anz.</th><th className="num">FTE</th><th className="num">€/h</th><th className="num">vs media gruppo</th><th className="num">vs mercato</th></tr></thead>
            <tbody>{rows.map(p => {
              const dg = g.all ? ((hourly(p) - g.all) / g.all) * 100 : 0, m = mk.get(p.funzione), dm = m ? ((baseHourly(p) - m) / m) * 100 : null;
              return (
                <tr key={p.id}><td><b>[{p.employee_code}]</b> {p.full_name}</td><td>{p.gender === "F" ? "Donna" : p.gender === "M" ? "Uomo" : "n.d."}</td>
                  <td className="text-sm">{p.sede}</td><td className="text-sm text-mut">{p.mansione}</td><td>{p.livello}</td>
                  <td className="num">{p.seniority_years !== null ? `${p.seniority_years.toLocaleString("it-IT")} a` : ""}</td><td className="num">{p.fte.toFixed(2).replace(".", ",")}</td>
                  <td className="num"><b>{eur2(hourly(p))}</b></td><td className="num" style={colDev(dg)}>{pc(dg)}</td><td className="num" style={dm === null ? undefined : colDev(dm)}>{pc(dm)}</td></tr>
              );
            })}</tbody></table>
        </div>
      </div>
    );
  }

  const key = (p: DbWorker) => (area ? p.funzione : p.area ?? "—");
  const groups = [...new Set(list.map(key))].sort().map(g => ({ g, s: stats(list.filter(p => key(p) === g)) }));
  return (
    <div className="space-y-4">
      <Crumb base={base} area={area} />{intro}
      <div className="card overflow-x-auto p-0">
        <table className="tbl"><thead><tr><th>{area ? "Funzione" : "Area"}</th><th className="num">Donne</th><th className="num">Uomini</th><th className="num">€/h donne</th><th className="num">€/h uomini</th><th className="num">Divario</th><th>Esito</th></tr></thead>
          <tbody>{groups.map(({ g, s: st }) => {
            const over = st.gap !== null && Math.abs(st.gap) >= 5;
            const href = area ? `${base}?area=${encodeURIComponent(area)}&fn=${encodeURIComponent(g)}` : `${base}?area=${encodeURIComponent(g)}`;
            return (
              <tr key={g}><td className="font-medium"><Link className="hover:underline" href={href}>{g} ›</Link></td><td className="num">{st.nF}</td><td className="num">{st.nM}</td>
                <td className="num">{st.mF !== null ? eur2(st.mF) : "—"}</td><td className="num">{st.mM !== null ? eur2(st.mM) : "—"}</td>
                <td className={`num ${over ? "font-semibold text-hi" : "text-mut"}`}>{st.gap !== null ? pc(st.gap) : "n.d."}</td>
                <td className="text-xs">{st.gap === null ? <span className="text-mut">Campione ridotto</span> : over ? <span className="text-hi">Da verificare</span> : <span className="text-lo">In soglia</span>}</td></tr>
            );
          })}</tbody></table>
        {!groups.length && <p className="p-5 text-sm text-mut">Nessun dato: carica il file Excel in «Dati & report Direttiva».</p>}
      </div>
    </div>
  );
}
