import Link from "next/link";
import { redirect } from "next/navigation";
import { dIt, sp } from "@/lib/format";
import { canRisk, session } from "@/lib/supabase/server";
import { deleteCase, updateCase } from "./actions";
import { loadCases } from "./shared";

export default async function Registro({ params, searchParams }: PageProps<"/periodi/[id]/registro">) {
  const { id } = await params;
  const s = await searchParams;
  const e = sp(s.e), m = sp(s.m);
  const { sb, membership } = await session();
  if (!canRisk(membership)) redirect(`/periodi/${id}`);
  const cases = await loadCases(sb, id);
  return (
    <div className="space-y-4">
      {e && <p className="rounded-md border border-hi px-3 py-2 text-sm text-hi">{e}</p>}
      {m && <p className="rounded-md border border-lo px-3 py-2 text-sm text-lo">{m}</p>}
      <div className="flex items-center gap-3"><h2 className="text-lg font-semibold">Registro casi</h2><span className="grow" />
        <a className="btn-sec" href={`/periodi/${id}/registro/csv`}>Esporta CSV</a></div>
      <div className="card overflow-x-auto p-0">
        {cases.length ? (
          <table className="tbl"><thead><tr><th>Data</th><th>Persona</th><th>Priorità</th><th>Stato e note</th><th /></tr></thead>
            <tbody>{cases.map(c => (
              <tr key={c.id}>
                <td className="text-mut">{dIt(c.created_at)}</td>
                <td><Link className="hover:underline" href={`/periodi/${id}/valutazione?w=${c.worker_id}`}><b>[{c.workers.employee_code}]</b> {c.workers.full_name}</Link><div className="text-xs text-mut">{c.workers.funzione}</div></td>
                <td>{c.priority}</td>
                <td>
                  <form action={updateCase.bind(null, id, c.id)} className="flex flex-wrap items-center gap-2">
                    <select name="status" defaultValue={c.status} className="input w-auto py-1">{["Aperto", "In corso", "Chiuso"].map(x => <option key={x}>{x}</option>)}</select>
                    <input name="note" defaultValue={c.note ?? ""} className="input min-w-64 flex-1 py-1" aria-label="Note" />
                    <button className="btn-sec py-1">Salva</button>
                  </form>
                </td>
                <td><form action={deleteCase.bind(null, id, c.id)}><button className="text-xs text-hi underline">Elimina</button></form></td>
              </tr>
            ))}</tbody></table>
        ) : <p className="p-5 text-sm text-mut">Nessun caso. Aprine uno da Segnali o da Valutazione.</p>}
      </div>
    </div>
  );
}
