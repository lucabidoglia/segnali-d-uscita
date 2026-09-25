import Link from "next/link";
import { redirect } from "next/navigation";
import { qs, sp } from "@/lib/format";
import { canRisk, session } from "@/lib/supabase/server";
import { bulk, rowAction } from "./actions";
import { loadSignals, PRI_ORDER, type Signal } from "./shared";

const PS = 40;
const PRI = ["Critica", "Alta", "Media", "Bassa"];

export default async function Segnali({ params, searchParams }: PageProps<"/periodi/[id]/segnali">) {
  const { id } = await params;
  const s = await searchParams;
  const f = { area: sp(s.area), sede: sp(s.sede), pri: sp(s.pri), stato: sp(s.stato), q: sp(s.q), sort: sp(s.sort) ?? "priority", dir: sp(s.dir) ?? "desc", page: sp(s.page) };
  const m = sp(s.m);
  const { sb, membership } = await session();
  if (!canRisk(membership)) redirect(`/periodi/${id}`);
  const all = await loadSignals(sb, id);

  const q = (f.q ?? "").trim().toLowerCase();
  const rows = all.filter(p =>
    (!f.sede || p.sede === f.sede) && (!f.area || p.area === f.area) && (!f.pri || p.priority === f.pri) &&
    (f.stato ? p.flag === f.stato : p.flag !== "snooze") &&
    (!q || `${p.full_name} ${p.employee_code} ${p.funzione} ${p.mansione}`.toLowerCase().includes(q)),
  ).sort((a, b) => {
    const key = f.sort as keyof Signal;
    const x = key === "priority" ? PRI_ORDER[a.priority ?? ""] ?? 0 : a[key], y = key === "priority" ? PRI_ORDER[b.priority ?? ""] ?? 0 : b[key];
    const c = typeof x === "number" || typeof y === "number" ? Number(x ?? 0) - Number(y ?? 0) : String(x ?? "").localeCompare(String(y ?? ""));
    return f.dir === "asc" ? c : -c;
  });
  const pages = Math.max(1, Math.ceil(rows.length / PS)), page = Math.min(pages - 1, Math.max(0, Number(f.page ?? 0) || 0));
  const vis = rows.slice(page * PS, page * PS + PS);
  const base = `/periodi/${id}/segnali`, cur = { ...f, page: String(page) };
  const back = base + qs(cur, {});

  const areas = [...new Set(all.map(p => p.area ?? "—"))].sort();
  const cnt = (fn: (p: Signal) => boolean) => all.filter(fn).length;
  const side = (label: string, n: number, on: boolean, href: string, d = 0) => (
    <li key={label + href}><Link href={href} className={`flex justify-between rounded px-2 py-1 text-sm ${on ? "bg-brand text-brand-fg" : "hover:bg-bg"}`} style={{ paddingLeft: 8 + d * 12 }}>
      <span className="truncate">{label}</span><small className="opacity-70">{n}</small></Link></li>
  );
  const th = (k: string, l: string, num = false) => (
    <th className={num ? "num" : ""}><Link href={base + qs(cur, { sort: k, dir: f.sort === k && f.dir === "desc" ? "asc" : "desc", page: null })}>{l}{f.sort === k ? (f.dir === "asc" ? " ▲" : " ▼") : ""}</Link></th>
  );
  const tag = (p: Signal) => p.flag === "auto" ? <span className="ml-1 rounded border border-lo px-1 text-xs text-lo">Monitorato</span> : p.flag === "snooze" ? <span className="ml-1 rounded border border-line px-1 text-xs text-mut">Rinviato</span> : null;
  const priCls: Record<string, string> = { Critica: "text-hi font-semibold", Alta: "text-mid font-semibold", Media: "", Bassa: "text-mut" };

  return (
    <div className="space-y-4">
      {m && <p className="rounded-md border border-lo px-3 py-2 text-sm text-lo">{m}</p>}
      <p className="note">La lista mostra solo nomi e priorità. Il punteggio e i fattori di una persona si aprono da «Valuta», scrivendo il motivo: ogni apertura resta registrata.</p>
      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <aside className="card space-y-3 p-3">
          <div><h4 className="mb-1 text-xs font-semibold uppercase text-mut">Sedi</h4><ul>
            {side("Tutte", all.length, !f.sede && !f.area, base + qs(cur, { sede: null, area: null, page: null }))}
            {areas.map(a => [side(a, cnt(p => (p.area ?? "—") === a), f.area === a, base + qs(cur, { area: a, sede: null, page: null }), 1),
              ...[...new Set(all.filter(p => (p.area ?? "—") === a).map(p => p.sede ?? "—"))].sort().map(st =>
                side(st, cnt(p => p.sede === st), f.sede === st, base + qs(cur, { sede: st, area: null, page: null }), 2))])}
          </ul></div>
          <div><h4 className="mb-1 text-xs font-semibold uppercase text-mut">Priorità</h4><ul>
            {side("Tutte", all.length, !f.pri, base + qs(cur, { pri: null, page: null }))}
            {PRI.map(p => side(p, cnt(x => x.priority === p), f.pri === p, base + qs(cur, { pri: p, page: null }), 1))}
            {side("Non valutate", cnt(x => !x.priority), false, base + qs(cur, { pri: null, page: null }), 1)}
          </ul></div>
          <div><h4 className="mb-1 text-xs font-semibold uppercase text-mut">Stato</h4><ul>
            {side("Attivi", cnt(p => p.flag !== "snooze"), !f.stato, base + qs(cur, { stato: null, page: null }))}
            {side("In monitoraggio", cnt(p => p.flag === "auto"), f.stato === "auto", base + qs(cur, { stato: "auto", page: null }), 1)}
            {side("Rinviati", cnt(p => p.flag === "snooze"), f.stato === "snooze", base + qs(cur, { stato: "snooze", page: null }), 1)}
          </ul></div>
        </aside>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Link className="btn-sec" href={`/periodi/${id}/valutazione`}>Nuova valutazione</Link>
            <Link className="btn-sec" href={base + qs({}, { pri: "Critica" })}>Priorità critiche</Link>
            <span className="grow" />
            <form className="flex gap-2" action={base}>
              {Object.entries(f).filter(([k, v]) => v && k !== "q" && k !== "page").map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
              <input className="input w-64" name="q" defaultValue={f.q} placeholder="Cerca persona, matricola, funzione…" aria-label="Cerca" />
            </form>
            <span className="text-sm text-mut">{rows.length ? page * PS + 1 : 0}–{Math.min(rows.length, (page + 1) * PS)} / {rows.length}</span>
            <Link className="btn-sec px-2" aria-label="Precedente" href={base + qs(cur, { page: String(Math.max(0, page - 1)) })}>‹</Link>
            <Link className="btn-sec px-2" aria-label="Successiva" href={base + qs(cur, { page: String(Math.min(pages - 1, page + 1)) })}>›</Link>
          </div>

          <form className="card overflow-x-auto p-0">
            <input type="hidden" name="back" value={back} />
            <div className="flex flex-wrap gap-2 border-b border-line p-3">
              <span className="self-center text-sm text-mut">Con i selezionati:</span>
              <button className="btn-sec" formAction={bulk.bind(null, id, "case")}>Apri casi</button>
              <button className="btn-sec" formAction={bulk.bind(null, id, "auto")}>Monitora</button>
              <button className="btn-sec" formAction={bulk.bind(null, id, "snooze")}>Rinvia</button>
              <button className="btn-sec" formAction={bulk.bind(null, id, "unflag")}>Riattiva</button>
              <button className="btn-sec" formAction={`/periodi/${id}/segnali/csv`} formMethod="get">Esporta CSV</button>
              <button className="btn-sec" formAction={`/periodi/${id}/documenti/scheda`} formMethod="get" name="formato" value="word">Schede formazione (Word)</button>
            </div>
            {vis.length ? (
              <table className="tbl">
                <thead><tr><th className="w-8" />{th("full_name", "Persona")}{th("sede", "Struttura")}{th("funzione", "Funzione")}{th("seniority_years", "Anz.", true)}{th("priority", "Priorità")}<th /></tr></thead>
                <tbody>{vis.map(p => (
                  <tr key={p.worker_id}>
                    <td><input type="checkbox" name="ids" value={p.worker_id} aria-label={`Seleziona ${p.full_name ?? p.employee_code}`} /></td>
                    <td><b>[{p.employee_code}]</b> {p.full_name}{tag(p)}</td>
                    <td className="text-sm">{p.sede}</td><td className="text-sm text-mut">{p.funzione}</td>
                    <td className="num">{p.seniority_years !== null ? `${p.seniority_years.toLocaleString("it-IT")} a` : ""}</td>
                    <td className={priCls[p.priority ?? ""] ?? "text-mut"}>{p.priority ?? "Non valutata"}</td>
                    <td className="whitespace-nowrap text-right">
                      <Link className="btn-sec px-2 py-1 text-xs" href={`/periodi/${id}/valutazione?w=${p.worker_id}`}>Valuta</Link>{" "}
                      <button className="btn-sec px-2 py-1 text-xs" formAction={rowAction.bind(null, id, p.worker_id, "case")}>Apri caso</button>{" "}
                      <button className="btn-sec px-2 py-1 text-xs" formAction={rowAction.bind(null, id, p.worker_id, p.flag === "auto" ? "unflag" : "auto")}>{p.flag === "auto" ? "Ferma" : "Monitora"}</button>{" "}
                      <button className="btn-sec px-2 py-1 text-xs" formAction={rowAction.bind(null, id, p.worker_id, p.flag === "snooze" ? "unflag" : "snooze")}>{p.flag === "snooze" ? "Riattiva" : "Rinvia"}</button>{" "}
                      <Link className="btn-sec px-2 py-1 text-xs" href={`/periodi/${id}/documenti?tipo=scheda&w=${p.worker_id}`}>Scheda</Link>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            ) : <p className="p-5 text-sm text-mut">Nessun segnale con questi filtri.</p>}
          </form>
        </div>
      </div>
    </div>
  );
}
