import Link from "next/link";
import { redirect } from "next/navigation";
import { sp } from "@/lib/format";
import { canSeePay, session } from "@/lib/supabase/server";
import { loadDbWorkers } from "../data";

const DOCS: [string, [string, string][]][] = [
  ["Individuali", [["scheda", "Scheda formazione finanziata"]]],
  ["Aziendali", [["divario", "Divario retributivo (D.Lgs. 96/2026)"], ["parita", "Parità di genere (UNI/PdR 125)"], ["piano", "Piano d'azione"]]],
];
const TITLE: Record<string, string> = { scheda: "Scheda formazione finanziata", divario: "Relazione sul divario retributivo", parita: "Dossier parità di genere", piano: "Piano d'azione" };

export default async function Documenti({ params, searchParams }: PageProps<"/periodi/[id]/documenti">) {
  const { id } = await params;
  const s = await searchParams;
  const tipo = sp(s.tipo) ?? "scheda";
  const { sb, membership } = await session();
  if (!canSeePay(membership)) redirect(`/periodi/${id}`);
  const ws = await loadDbWorkers(sb, id);
  const w = sp(s.w) ?? ws.find(x => x.training_title)?.id ?? ws[0]?.id;
  const base = `/periodi/${id}/documenti`;
  const src = `${base}/${tipo}?${tipo === "scheda" ? `w=${w}&` : ""}`;
  const aree = [...new Set(ws.map(x => x.area ?? "—"))].sort();

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <aside className="card space-y-3 p-3">
        {DOCS.map(([g, items]) => (
          <div key={g}><h4 className="mb-1 text-xs font-semibold uppercase text-mut">{g}</h4><ul>
            {items.map(([k, l]) => <li key={k}><Link className={`block rounded px-2 py-1 text-sm ${tipo === k ? "bg-brand text-brand-fg" : "hover:bg-bg"}`} href={`${base}?tipo=${k}`}>{l}</Link></li>)}
          </ul></div>
        ))}
        <div><h4 className="mb-1 text-xs font-semibold uppercase text-mut">Impostazioni</h4>
          <Link className="block rounded px-2 py-1 text-sm hover:bg-bg" href="/impostazioni">Dati azienda e fondo</Link></div>
      </aside>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">{TITLE[tipo]}</h2><span className="grow" />
          {ws.length > 0 && <>
            <a className="btn-sec" href={`${src}formato=stampa`} target="_blank" rel="noopener">Stampa / PDF</a>
            <a className="btn" href={`${src}formato=word`}>Scarica Word</a>
          </>}
        </div>
        {!ws.length ? <p className="note">Nessun dato: carica il file Excel in «Dati & report Direttiva».</p> : <>
          {tipo === "scheda" && (
            <div className="card flex flex-wrap items-end gap-3">
              <form className="flex min-w-72 grow items-end gap-2" action={base}>
                <input type="hidden" name="tipo" value="scheda" />
                <div className="grow"><label className="label" htmlFor="w">Persona</label>
                  <select id="w" name="w" className="input" defaultValue={w}>{ws.map(x => <option key={x.id} value={x.id}>{x.full_name ?? x.employee_code} · {x.funzione}{x.training_title ? "" : " (senza formazione)"}</option>)}</select></div>
                <button className="btn-sec">Mostra</button>
              </form>
              <form className="flex items-end gap-2" action={`${base}/scheda`}>
                <input type="hidden" name="formato" value="word" />
                <div><label className="label" htmlFor="scope">Fascicolo per</label>
                  <select id="scope" name="scope" className="input"><option value="all">Tutte le persone ({ws.length})</option>{aree.map(a => <option key={a} value={`a:${a}`}>Area {a} ({ws.filter(x => (x.area ?? "—") === a).length})</option>)}</select></div>
                <button className="btn-sec">Genera fascicolo (Word)</button>
              </form>
            </div>
          )}
          <iframe title={TITLE[tipo]} src={`${src}formato=anteprima`} className="h-[75vh] w-full rounded-lg border border-line bg-white" />
        </>}
      </div>
    </div>
  );
}
