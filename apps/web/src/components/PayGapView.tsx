import type { PayGapReport, ReportingObligation } from "@g1g10/engine";

const pc = (v: number | null) => (v === null || !Number.isFinite(v) ? "n.d." : `${v > 0 ? "+" : ""}${v.toLocaleString("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`);
const p0 = (v: number) => `${Math.round(v)}%`;
const eur = (v: number) => (Number.isFinite(v) ? v.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—");
const bad = (v: number | null) => v !== null && Math.abs(v) >= 5;

function Kpi({ k, v, warn }: { k: string; v: string; warn?: boolean }) {
  return <div className="card py-3"><div className="text-xs text-mut">{k}</div><div className={`text-2xl font-semibold ${warn ? "text-hi" : ""}`}>{v}</div></div>;
}

/** Report sul divario retributivo, art. 9 Dir. (UE) 2023/970. */
export function PayGapView({ r, obligation }: { r: PayGapReport; obligation: ReportingObligation }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi k="Lavoratori" v={`${r.headcount}`} />
        <Kpi k="a) Divario medio" v={pc(r.gapMean)} warn={bad(r.gapMean)} />
        <Kpi k="c) Divario mediano" v={pc(r.gapMedian)} warn={bad(r.gapMedian)} />
        <Kpi k="Categorie ≥ 5%" v={`${r.jointAssessmentCandidates.length}`} warn={r.jointAssessmentCandidates.length > 0} />
      </div>

      <p className="note">
        Divario = (livello retributivo orario medio uomini − donne) ÷ uomini. Il livello retributivo comprende solo gli
        elementi <b>fissi e continuativi</b> (D.Lgs. 96/2026, art. 3 lett. b); premi e componenti variabili hanno indicatori propri.
        Positivo = donne pagate meno. Retribuzione complessiva con variabile, solo informativa: {pc(r.gapTotalMean ?? null)}. Considerati {r.counted.F} donne e {r.counted.M} uomini
        {r.excluded.notDeclared + r.excluded.noHours > 0 && ` (esclusi: ${r.excluded.notDeclared} genere non dichiarato, ${r.excluded.noHours} senza ore)`}.
        {" "}<b>Obbligo di comunicazione:</b> {obligation.required ? `${obligation.frequency}, prima scadenza ${new Date(obligation.firstDeadline!).toLocaleDateString("it-IT")}` : "non obbligatoria"} — {obligation.note}
      </p>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="card">
          <h2 className="mb-2 font-semibold">Componenti variabili</h2>
          <table className="tbl"><tbody>
            <tr><td>b) Divario medio del variabile (tra chi lo percepisce)</td><td className={`num ${bad(r.gapVariableMean) ? "text-hi" : ""}`}>{pc(r.gapVariableMean)}</td></tr>
            <tr><td>d) Divario mediano del variabile</td><td className={`num ${bad(r.gapVariableMedian) ? "text-hi" : ""}`}>{pc(r.gapVariableMedian)}</td></tr>
            <tr><td>e) Donne che percepiscono variabile</td><td className="num">{p0(r.variableRecipients.F)}</td></tr>
            <tr><td>e) Uomini che percepiscono variabile</td><td className="num">{p0(r.variableRecipients.M)}</td></tr>
          </tbody></table>
        </div>
        <div className="card">
          <h2 className="mb-2 font-semibold">f) Quartili retributivi</h2>
          <table className="tbl"><thead><tr><th>Quartile</th><th className="num">€/h</th><th className="num">Donne</th><th className="num">Uomini</th></tr></thead>
            <tbody>{r.quartiles.map(q => (
              <tr key={q.index}><td>Q{q.index}{q.index === 1 ? " (più bassi)" : q.index === 4 ? " (più alti)" : ""}</td>
                <td className="num">{eur(q.minHourly)} – {eur(q.maxHourly)}</td><td className="num">{p0(q.shareF)}</td><td className="num">{p0(q.shareM)}</td></tr>
            ))}</tbody></table>
        </div>
      </div>

      <div className="card overflow-x-auto p-0">
        <h2 className="px-5 pt-4 font-semibold">g) Divario per categoria di lavoratori</h2>
        <table className="tbl mt-2"><thead><tr>
          <th>Categoria</th><th className="num">Donne / Uomini</th><th className="num">€/h donne</th><th className="num">€/h uomini</th>
          <th className="num">Divario medio</th><th className="num">mediano</th><th className="num">variabile</th><th className="num">complessiva</th><th>Esito</th>
        </tr></thead>
          <tbody>{r.categories.map(c => (
            <tr key={c.category}>
              <td className="font-medium">{c.category}</td><td className="num">{c.n.F} / {c.n.M}</td>
              <td className="num">{c.meanHourly ? eur(c.meanHourly.F) : "—"}</td><td className="num">{c.meanHourly ? eur(c.meanHourly.M) : "—"}</td>
              <td className={`num ${c.overThreshold ? "font-semibold text-hi" : ""}`}>{pc(c.gapMean)}</td><td className="num">{pc(c.gapMedian)}</td>
              <td className="num">{pc(c.gapVariableMean)}</td><td className="num text-mut">{pc(c.gapTotalMean ?? null)}</td>
              <td className="text-xs">{!c.published ? <span className="text-mut">Campione ridotto</span> : c.overThreshold ? <span className="text-hi">Da giustificare o correggere</span> : <span className="text-lo">In soglia</span>}</td>
            </tr>
          ))}</tbody></table>
        {r.jointAssessmentCandidates.length > 0 && (
          <p className="note m-4">
            {r.jointAssessmentCandidates.length} categorie hanno un divario ≥ 5%. Se non è giustificato da criteri oggettivi e neutri rispetto al genere
            e non viene corretto entro 6 mesi dalla comunicazione, il D.Lgs. 96/2026 (art. 10) richiede una <b>valutazione congiunta</b> con le rappresentanze dei lavoratori.
          </p>
        )}
      </div>
    </div>
  );
}
