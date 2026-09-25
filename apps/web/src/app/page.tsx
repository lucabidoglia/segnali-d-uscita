import Link from "next/link";
import { canSeePay, session } from "@/lib/supabase/server";
import { createOrganization, createPeriod } from "./actions";

const d = (s: string) => new Date(s).toLocaleDateString("it-IT");

export default async function Home({ searchParams }: PageProps<"/">) {
  const { e } = await searchParams;
  const { sb, membership } = await session();
  const err = e && <p className="mb-4 rounded-md border border-hi px-3 py-2 text-sm text-hi">{e}</p>;

  if (!membership) return (
    <div className="mx-auto max-w-lg">
      {err}
      <form action={createOrganization} className="card space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Crea la tua azienda</h1>
          <p className="text-sm text-mut">Diventerai amministratore: potrai poi invitare HR, revisore e lettori. I dati di ogni azienda restano separati da quelli delle altre.</p>
        </div>
        <div><label className="label" htmlFor="name">Ragione sociale</label><input className="input" id="name" name="name" required /></div>
        <div><label className="label" htmlFor="vat">Partita IVA (facoltativa)</label><input className="input" id="vat" name="vat" /></div>
        <button className="btn">Crea azienda</button>
      </form>
    </div>
  );

  const { data: periods } = await sb.from("periods").select("id, label, starts_on, ends_on").eq("org_id", membership.org_id).order("starts_on", { ascending: false });
  const pay = canSeePay(membership);
  const year = new Date().getFullYear() - 1;

  return (
    <div className="space-y-6">
      {err}
      <div className="flex flex-wrap items-end gap-3">
        <h1 className="text-2xl font-semibold">Periodi di riferimento</h1>
        <span className="grow" />
        {pay && <a className="btn-sec" href="/modello">Scarica modello Excel</a>}
        {pay && <a className="btn-sec" href="/esempio">Scarica esempio (dati inventati)</a>}
      </div>

      <div className="card p-0">
        {periods?.length ? (
          <table className="tbl"><thead><tr><th>Periodo</th><th>Dal</th><th>Al</th><th /></tr></thead>
            <tbody>{periods.map(p => (
              <tr key={p.id}><td className="font-medium">{p.label}</td><td>{d(p.starts_on)}</td><td>{d(p.ends_on)}</td>
                <td className="num"><Link className="text-brand underline" href={`/periodi/${p.id}`}>Apri</Link></td></tr>
            ))}</tbody></table>
        ) : <p className="p-5 text-sm text-mut">Nessun periodo. {pay ? "Creane uno qui sotto, poi carica il file Excel." : "Chiedi all'HR di caricare i dati."}</p>}
      </div>

      {pay && (
        <form action={createPeriod} className="card grid gap-4 sm:grid-cols-4 sm:items-end">
          <div className="sm:col-span-4"><h2 className="font-semibold">Nuovo periodo</h2><p className="text-sm text-mut">Per la Direttiva il riferimento è l&apos;anno solare precedente.</p></div>
          <div><label className="label" htmlFor="label">Nome</label><input className="input" id="label" name="label" defaultValue={`Anno ${year}`} required /></div>
          <div><label className="label" htmlFor="start">Dal</label><input className="input" id="start" name="start" type="date" defaultValue={`${year}-01-01`} required /></div>
          <div><label className="label" htmlFor="end">Al</label><input className="input" id="end" name="end" type="date" defaultValue={`${year}-12-31`} required /></div>
          <button className="btn justify-center">Crea periodo</button>
        </form>
      )}
    </div>
  );
}
