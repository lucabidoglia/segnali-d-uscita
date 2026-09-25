"use client";
import { useMemo, useState } from "react";
import { computeRisk, type RiskFactors } from "@g1g10/engine";
import { COMP_OPTS, FACTORS, REPLACEMENT_MULT } from "@/lib/factors";
import { eur0, eur2 } from "@/lib/format";

interface Props {
  initial: RiskFactors; hourly?: number; market?: number; ral: number;
  save?: (fd: FormData) => void | Promise<void>;
}

/** Schermata di valutazione: il punteggio si ricalcola mentre si scelgono i fattori (stesso motore del server). */
export function EvalForm({ initial, hourly, market, ral: ral0, save }: Props) {
  const [f, setF] = useState<RiskFactors>(initial);
  const [ral, setRal] = useState(Math.round(ral0));
  const [interv, setInterv] = useState(2500);
  const r = useMemo(() => computeRisk(f, hourly, market), [f, hourly, market]);
  const col = r.level === "Alto" ? "hi" : r.level === "Medio" ? "mid" : "lo";
  const mx = Math.max(1, ...r.drivers.map(d => Math.abs(d.points)));
  const cost = ral * REPLACEMENT_MULT, atRisk = (cost * r.score) / 100;
  const seg = (key: keyof RiskFactors, head: string, opts: [number, string][]) => (
    <div key={key}>
      <div className="label">{head}</div>
      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={head}>
        {opts.map(([v, l]) => (
          <label key={v} className={`cursor-pointer rounded-md border px-2.5 py-1 text-sm ${f[key] === v ? "border-brand bg-brand text-brand-fg" : "border-line hover:bg-bg"}`}>
            <input type="radio" className="sr-only" name={key} value={v} checked={f[key] === v} onChange={() => setF({ ...f, [key]: v })} />{l}
          </label>
        ))}
      </div>
    </div>
  );
  const withMarket = hourly !== undefined && market !== undefined;
  return (
    <form action={save} className="grid items-start gap-5 lg:grid-cols-2">
      <div className="card space-y-3">
        <h2 className="font-semibold">Fattori</h2>
        {FACTORS.filter(d => d.key !== "perf" && d.key !== "crit").map(d => seg(d.key, d.head, d.opts))}
        {withMarket
          ? <p className="note">Retribuzione di base {eur2(hourly!)} €/h vs mercato {eur2(market!)} €/h ({r.marketDeviation! > 0 ? "+" : ""}{r.marketDeviation!.toFixed(0)}%).</p>
          : seg("comp", "Retribuzione (manuale: manca il riferimento di mercato)", COMP_OPTS)}
        {FACTORS.filter(d => d.key === "perf" || d.key === "crit").map(d => seg(d.key, d.head, d.opts))}
      </div>
      <div className="space-y-5">
        <div className="card">
          <h2 className="font-semibold">Esito</h2>
          <div className="mt-2 flex items-center gap-5">
            <div className="text-5xl font-bold" style={{ color: `var(--${col})` }}>{r.score}</div>
            <div><div className="font-semibold" style={{ color: `var(--${col})` }}>Rischio {r.level.toLowerCase()}</div><div className="text-sm">Priorità <b>{r.priority}</b></div></div>
          </div>
          <div className="mt-3 h-2 rounded bg-bg"><i className="block h-full rounded" style={{ width: `${r.score}%`, background: `var(--${col})` }} /></div>
          <h3 className="mb-2 mt-4 text-sm font-semibold">Driver</h3>
          {r.drivers.length ? r.drivers.map(d => (
            <div key={d.key} className="grid grid-cols-[130px_1fr_40px] items-center gap-2 py-0.5 text-sm">
              <span>{d.label}</span>
              <span className="relative h-2 rounded bg-bg"><i className="absolute top-0 block h-full rounded" style={{ background: `var(--${d.points > 0 ? "hi" : "lo"})`, [d.points > 0 ? "left" : "right"]: "50%", width: `${(Math.abs(d.points) / mx) * 50}%` }} /></span>
              <b className="text-right tabular-nums">{d.points > 0 ? "+" : ""}{d.points}</b>
            </div>
          )) : <p className="text-sm text-mut">Nessun fattore attivo.</p>}
          <p className="mt-3 text-xs text-mut">Modello di rischio v{r.modelVersion}: regole fisse definite da persone, non un sistema che apprende dai dati.</p>
        </div>
        <div className="card space-y-3">
          <h2 className="font-semibold">Economia della ritenzione</h2>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label" htmlFor="ral">RAL (€)</label><input id="ral" className="input" type="number" min={0} step={500} value={ral} onChange={e => setRal(+e.target.value || 0)} /></div>
            <div><label className="label" htmlFor="interv">Costo intervento (€)</label><input id="interv" className="input" type="number" min={0} step={100} value={interv} onChange={e => setInterv(+e.target.value || 0)} /></div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="rounded-md bg-bg p-2"><div className="text-xs text-mut">Costo sostituzione</div><b>€ {eur0(cost)}</b></div>
            <div className="rounded-md bg-bg p-2"><div className="text-xs text-mut">Costo a rischio</div><b className={r.score >= 70 ? "text-hi" : ""}>€ {eur0(atRisk)}</b></div>
            <div className="rounded-md bg-bg p-2"><div className="text-xs text-mut">A rischio ÷ intervento</div><b>{interv > 0 ? `${(atRisk / interv).toFixed(1).replace(".", ",")}×` : "—"}</b></div>
          </div>
        </div>
        {save ? (
          <div className="card space-y-3">
            <div><label className="label" htmlFor="note">Nota per il Registro (facoltativa)</label><input id="note" name="note" className="input" placeholder="Es. colloquio fissato con la coordinatrice" /></div>
            <div className="flex flex-wrap gap-2">
              <button className="btn">Salva valutazione</button>
              <button className="btn-sec" name="openCase" value="1">Salva e apri caso</button>
            </div>
          </div>
        ) : <p className="note">Simulazione libera: niente viene salvato.</p>}
      </div>
    </form>
  );
}
