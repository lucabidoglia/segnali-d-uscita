import { HORIZONS, horizon, type Priority } from "@/lib/actionPlan";
import { dIt, sp } from "@/lib/format";
import { canSeePay, session } from "@/lib/supabase/server";
import { saveAction } from "./actions";
import { loadPlan } from "./shared";

const PRI: Record<Priority, string> = { Critica: "border-hi text-hi", Alta: "border-mid text-mid", Media: "border-line text-fg", Bassa: "border-line text-mut" };
const ST: Record<string, string> = { "Da fare": "text-mut", "In corso": "text-mid", Fatto: "text-lo", "Non applicabile": "text-mut line-through" };

export default async function Piano({ params, searchParams }: PageProps<"/periodi/[id]/piano">) {
  const { id } = await params;
  const s = await searchParams;
  const e = sp(s.e), m = sp(s.m), area = sp(s.area);
  const { sb, membership } = await session();
  const edit = canSeePay(membership);
  const { today, planned } = await loadPlan(sb, membership!, id);
  const open = planned.filter(a => !["Fatto", "Non applicabile"].includes(a.state?.status ?? "Da fare"));
  const count = (p: Priority) => open.filter(a => a.priority === p).length;
  const areas = [...new Set(planned.map(a => a.area))];
  const shown = planned.filter(a => !area || a.area === area);

  return (
    <div className="space-y-5">
      {e && <p className="rounded-md border border-hi px-3 py-2 text-sm text-hi">{e}</p>}
      {m && <p className="rounded-md border border-lo px-3 py-2 text-sm text-lo">{m}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">Piano d&apos;azione</h2>
        <span className="text-sm text-mut">generato dai dati del periodo e dalla normativa al {dIt(today)}</span>
        <span className="grow" />
        {edit && <>
          <a className="btn-sec" href={`/periodi/${id}/documenti/piano?formato=stampa`} target="_blank" rel="noopener">Stampa / PDF</a>
          <a className="btn" href={`/periodi/${id}/documenti/piano?formato=word`}>Scarica Word</a>
        </>}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {(["Critica", "Alta", "Media", "Bassa"] as Priority[]).map(p => (
          <div key={p} className={`card border-l-4 py-3 ${PRI[p].split(" ")[0]}`}><div className="text-xs text-mut">Priorità {p.toLowerCase()}</div><div className="text-2xl font-semibold">{count(p)}</div></div>
        ))}
        <div className="card py-3"><div className="text-xs text-mut">In ritardo</div><div className={`text-2xl font-semibold ${open.some(a => a.late) ? "text-hi" : ""}`}>{open.filter(a => a.late).length}</div></div>
      </div>
      <p className="note">
        <b>Critica</b>: obbligo di legge a rischio o danno imminente · <b>Alta</b>: da avviare entro 3 mesi · <b>Media</b>: entro 6–12 mesi · <b>Bassa</b>: miglioramento.
        Le azioni si aggiornano da sole quando cambiano i dati; lo stato, il responsabile e le note che scrivete restano salvati. Fatte: {planned.length - open.length} su {planned.length}.
      </p>

      <nav className="flex flex-wrap gap-1.5" aria-label="Aree">
        <a href={`/periodi/${id}/piano`} className={`rounded-full border px-3 py-1 text-sm ${!area ? "border-brand bg-brand text-brand-fg" : "border-line"}`}>Tutte</a>
        {areas.map(a => <a key={a} href={`/periodi/${id}/piano?area=${encodeURIComponent(a)}`} className={`rounded-full border px-3 py-1 text-sm ${area === a ? "border-brand bg-brand text-brand-fg" : "border-line"}`}>{a}</a>)}
      </nav>

      {HORIZONS.map(h => {
        const list = shown.filter(a => horizon(today, a.dueEff) === h || (h === HORIZONS[0] && a.dueEff < today));
        if (!list.length) return null;
        return (
          <section key={h} className="space-y-3">
            <h3 className="font-semibold">{h} <span className="text-sm font-normal text-mut">· {list.length}</span></h3>
            {list.map(a => (
              <div key={a.key} id={`a-${a.key}`} className={`card space-y-2 border-l-4 ${PRI[a.priority].split(" ")[0]}`}>
                <div className="flex flex-wrap items-start gap-2">
                  <span className={`rounded border px-1.5 text-xs font-semibold ${PRI[a.priority]}`}>{a.priority}</span>
                  <span className="rounded border border-line px-1.5 text-xs text-mut">{a.area}</span>
                  <h4 className={`grow font-semibold ${ST[a.state?.status ?? "Da fare"] === "text-mut line-through" ? "line-through text-mut" : ""}`}>{a.title}</h4>
                  <span className={`text-sm ${a.late ? "font-semibold text-hi" : "text-mut"}`}>{a.late ? "in ritardo · " : ""}entro il {dIt(a.dueEff)}</span>
                </div>
                <p className="text-sm">{a.why}</p>
                <details className="text-sm"><summary className="cursor-pointer text-brand">Cosa fare{a.rif ? ` · ${a.rif}` : ""} · responsabile suggerito: {a.owner}</summary>
                  <ol className="mt-2 list-decimal space-y-1 pl-5">{a.steps.map(x => <li key={x}>{x}</li>)}</ol>
                </details>
                {edit ? (
                  <form action={saveAction.bind(null, id, a.key)} className="flex flex-wrap items-end gap-2 border-t border-line pt-2">
                    <div><label className="label" htmlFor={`s-${a.key}`}>Stato</label>
                      <select id={`s-${a.key}`} name="status" defaultValue={a.state?.status ?? "Da fare"} className="input w-auto py-1">{["Da fare", "In corso", "Fatto", "Non applicabile"].map(x => <option key={x}>{x}</option>)}</select></div>
                    <div><label className="label" htmlFor={`o-${a.key}`}>Responsabile</label><input id={`o-${a.key}`} name="owner" defaultValue={a.state?.owner ?? ""} placeholder={a.owner} className="input w-48 py-1" /></div>
                    <div><label className="label" htmlFor={`d-${a.key}`}>Scadenza</label><input id={`d-${a.key}`} name="due" type="date" defaultValue={a.dueEff} className="input w-auto py-1" /></div>
                    <div className="min-w-56 grow"><label className="label" htmlFor={`n-${a.key}`}>Note</label><input id={`n-${a.key}`} name="note" defaultValue={a.state?.note ?? ""} className="input py-1" /></div>
                    <button className="btn-sec py-1">Salva</button>
                  </form>
                ) : a.state && <p className={`text-xs ${ST[a.state.status]}`}>Stato: {a.state.status}{a.state.owner ? ` · ${a.state.owner}` : ""}</p>}
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}
