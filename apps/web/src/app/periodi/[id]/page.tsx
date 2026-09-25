import { notFound } from "next/navigation";
import { payGapReport, reportingObligation, type PayGapReport } from "@g1g10/engine";
import { PayGapView } from "@/components/PayGapView";
import { canSeePay, session } from "@/lib/supabase/server";
import type { RowIssue } from "@/lib/excel";
import { finalizeReport, importExcel, saveReport } from "./actions";
import { loadPeriod, loadWorkers } from "./data";

import { dtIt as dt } from "@/lib/format";

export default async function Periodo({ params, searchParams }: PageProps<"/periodi/[id]">) {
  const { id } = await params;
  const { e } = await searchParams;
  const { sb, membership } = await session();
  if (!membership) notFound();
  const period = await loadPeriod(sb, id);
  if (!period) notFound();
  const pay = canSeePay(membership);

  const { data: reports } = await sb.from("pay_reports").select("id, created_at, finalized_at, engine_version, payload").eq("period_id", id).order("created_at", { ascending: false });
  const lastImport = pay ? (await sb.from("imports").select("file_name, row_count, issues, created_at").eq("period_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle()).data : null;
  const workers = pay ? await loadWorkers(sb, id) : [];
  const live = workers.length ? payGapReport(workers) : null;
  const shown: PayGapReport | null = live ?? ((reports?.[0]?.payload as PayGapReport | undefined) ?? null);
  const issues = (lastImport?.issues ?? []) as RowIssue[];
  const errors = issues.filter(i => i.severity === "errore"), warns = issues.filter(i => i.severity === "avviso");

  return (
    <div className="space-y-6">
      {e && <p className="rounded-md border border-hi px-3 py-2 text-sm text-hi">{e}</p>}

      {pay && (
        <div className="card space-y-3">
          <h2 className="font-semibold">Carica i dati retributivi</h2>
          <form action={importExcel.bind(null, id)} className="flex flex-wrap items-center gap-3">
            <input type="file" name="file" accept=".xlsx" required className="text-sm" />
            <button className="btn">Carica e controlla</button>
            <a className="text-sm text-brand underline" href="/modello">modello vuoto</a>
            <a className="text-sm text-brand underline" href="/esempio">esempio con dati inventati</a>
          </form>
          <p className="text-xs text-mut">Un nuovo caricamento aggiorna le persone già presenti (casi e valutazioni restano) e toglie chi non c&apos;è più. Se il file contiene errori non viene importato nulla. Fogli facoltativi: «Fattori rischio» (solo HR rischio) e «Mercato».</p>
          {lastImport && (
            <div className={`rounded-md border px-4 py-3 text-sm ${errors.length ? "border-hi" : "border-lo"}`}>
              <b>{errors.length ? "File scartato" : "File importato"}</b>: {lastImport.file_name} · {dt(lastImport.created_at)}
              {!errors.length && ` · ${lastImport.row_count} persone`}
              {[...errors, ...warns].length > 0 && (
                <ul className="mt-2 max-h-60 list-disc space-y-0.5 overflow-auto pl-5">
                  {[...errors, ...warns].slice(0, 200).map((i, k) => (
                    <li key={k} className={i.severity === "errore" ? "text-hi" : "text-mid"}>
                      {i.sheet ? `[${i.sheet}] ` : ""}{i.row ? `Riga ${i.row}` : ""}{i.row && i.id ? " · " : ""}{i.id ? `matricola ${i.id}` : ""}{i.row || i.id ? ": " : ""}{i.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {shown ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold">Report sul divario retributivo</h2>
            <span className="text-sm text-mut">{live ? "calcolato sui dati attuali" : "ultimo report salvato"}</span>
            <span className="grow" />
            {pay && live && <form action={saveReport.bind(null, id)}><button className="btn">Salva una copia del report</button></form>}
          </div>
          <PayGapView r={shown} obligation={reportingObligation(shown.headcount)} />
        </section>
      ) : <p className="note">{pay ? "Nessun dato: carica il file Excel del periodo." : "Nessun report disponibile per questo periodo."}</p>}

      {!!reports?.length && (
        <div id="report-salvati" className="card p-0">
          <h2 className="px-5 pt-4 font-semibold">Report salvati</h2>
          <table className="tbl mt-2"><thead><tr><th>Creato</th><th>Motore</th><th className="num">Divario medio</th><th>Stato</th><th /></tr></thead>
            <tbody>{reports.map(r => {
              const g = (r.payload as PayGapReport).gapMean;
              return (
                <tr key={r.id}>
                  <td>{dt(r.created_at)}</td><td className="text-mut">v{r.engine_version}</td>
                  <td className="num">{g === null ? "n.d." : `${g.toFixed(1).replace(".", ",")}%`}</td>
                  <td>{r.finalized_at ? <span className="text-lo">Definitivo dal {dt(r.finalized_at)}</span> : <span className="text-mut">Bozza</span>}</td>
                  <td className="num">{pay && !r.finalized_at && (
                    <form action={finalizeReport.bind(null, id, r.id)}><button className="btn-sec" title="Dopo non si potrà più modificare né cancellare">Rendi definitivo</button></form>
                  )}</td>
                </tr>
              );
            })}</tbody></table>
          <p className="px-5 pb-4 pt-2 text-xs text-mut">Un report definitivo non si può più modificare né cancellare: resta come prova per eventuali verifiche (art. 18 Dir. 2023/970).</p>
        </div>
      )}
    </div>
  );
}
