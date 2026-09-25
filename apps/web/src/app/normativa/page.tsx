import { COLLEGATE, FONTI, IN_ATTESA, NORMA, PARAMETRI, SEZIONI, SINTESI, VERIFIED_ON } from "@/lib/normativa";
import watch from "@/lib/normativa-watch.json";
import { dIt } from "@/lib/format";

export const metadata = { title: "Normativa · Segnali d'uscita" };

export default function Normativa() {
  const pending = watch.pending as null | { since: string; sources: { name: string }[] };
  return (
    <article className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Equità retributiva: la norma in breve</h1>
        <p className="text-sm text-mut"><b>{NORMA.titolo}</b> — {NORMA.descrizione}. {NORMA.gazzetta}, in vigore dal {dIt(NORMA.vigore)}.</p>
        {pending ? (
          <p className="rounded-md border border-mid px-3 py-2 text-sm text-mid" role="status">
            <b>Norma in verifica.</b> Dal {dIt(pending.since)} è cambiata una fonte ufficiale ({pending.sources.map(s => s.name).join("; ")}). Questa pagina è in revisione: fino all&apos;aggiornamento fate riferimento al testo ufficiale.
          </p>
        ) : (
          <p className="rounded-md border border-lo px-3 py-2 text-sm text-lo" role="status">
            Testo verificato il {dIt(VERIFIED_ON)} sulle fonti ufficiali. Un controllo automatico settimanale segnala qui eventuali modifiche della norma: al momento nessuna.
          </p>
        )}
      </header>

      <section className="card space-y-2">
        <h2 className="font-semibold">In sintesi</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm">{SINTESI.map(s => <li key={s}>{s}</li>)}</ul>
      </section>

      <section className="card overflow-x-auto p-0">
        <h2 className="px-5 pt-4 font-semibold">I parametri da rispettare</h2>
        <table className="tbl mt-2"><thead><tr><th>Cosa</th><th>Valore</th><th>Dove</th><th>Nell&apos;app</th></tr></thead>
          <tbody>{PARAMETRI.map(p => (
            <tr key={p.cosa}><td>{p.cosa}</td><td className="font-semibold">{p.valore}</td><td className="whitespace-nowrap text-mut">{p.rif}</td><td className="text-xs text-mut">{p.app ?? ""}</td></tr>
          ))}</tbody></table>
      </section>

      {SEZIONI.map(s => (
        <section key={s.titolo} className="card space-y-2">
          <h2 className="font-semibold">{s.titolo} <span className="text-sm font-normal text-mut">· {s.rif}</span></h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">{s.punti.map(p => <li key={p}>{p}</li>)}</ul>
          {s.app && <p className="note">Nell&apos;app: {s.app}</p>}
        </section>
      ))}

      <section className="card overflow-x-auto p-0">
        <h2 className="px-5 pt-4 font-semibold">Atti attuativi attesi</h2>
        <table className="tbl mt-2"><thead><tr><th>Cosa</th><th>Entro</th><th>Dove</th><th>Stato al {dIt(VERIFIED_ON)}</th></tr></thead>
          <tbody>{IN_ATTESA.map(a => <tr key={a.cosa}><td>{a.cosa}</td><td className="whitespace-nowrap">{a.entro}</td><td className="whitespace-nowrap text-mut">{a.rif}</td><td className="text-mut">{a.stato}</td></tr>)}</tbody></table>
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold">Norme collegate</h2>
        <ul className="space-y-1.5 text-sm">{COLLEGATE.map(c => <li key={c.nome}><b>{c.nome}</b> — {c.cosa}</li>)}</ul>
      </section>

      <footer className="space-y-2 text-sm">
        <h2 className="font-semibold">Testi ufficiali</h2>
        <ul className="list-disc pl-5">{FONTI.map(f => <li key={f.url}><a className="text-brand underline" href={f.url} target="_blank" rel="noopener">{f.nome}</a></li>)}</ul>
        <p className="note">Sintesi a scopo informativo, non è una consulenza legale: per i casi concreti fanno fede i testi ufficiali e il parere del consulente del lavoro o del legale. La pagina si aggiorna solo quando cambia la norma: ogni settimana un controllo automatico confronta le fonti ufficiali con la versione verificata.</p>
      </footer>
    </article>
  );
}
