import "server-only";
import { gapPct, mean, median, payGapReport, reportingObligation } from "@g1g10/engine";
import type { DbWorker, Period } from "@/app/periodi/[id]/data";
import { hourly, periodMonths, toEngine } from "@/app/periodi/[id]/data";
import { eur0, eur2, n1, pc } from "./format";
import type { Settings } from "./settings";

/** Documenti generati (porta dal prototipo v1.3.0): HTML che diventa Word (.doc) o PDF dalla stampa. */
export interface DocCtx { s: Settings; period: Period; version: string }

const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const E2 = (v: number) => "€ " + eur2(v);
const todayIt = () => new Date().toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });
const periodoIt = (p: Period) => `${new Date(p.starts_on).toLocaleDateString("it-IT")} – ${new Date(p.ends_on).toLocaleDateString("it-IT")}`;
const tbl = (head: string[], rows: (string | number)[][], right: number[] = []) =>
  `<table><tr>${head.map((h, i) => `<th class="${right.includes(i) ? "n" : ""}">${h}</th>`).join("")}</tr>${rows.map(r => `<tr>${r.map((c, i) => `<td class="${right.includes(i) ? "n" : ""}">${c}</td>`).join("")}</tr>`).join("")}</table>`;
const kv = (rows: [string, string | number][]) => `<table>${rows.map(r => `<tr><td style="width:42%">${r[0]}</td><td>${r[1]}</td></tr>`).join("")}</table>`;
const foot = (c: DocCtx) => `<div class="foot">Documento generato con Segnali d'uscita · Powered by G1G10 v${esc(c.version)}. Verificare dati e testo normativo vigente prima dell'uso ufficiale.</div>`;
const sign = (c: DocCtx, extra = "") => {
  const city = c.s.sede.split(",").pop()?.replace(/\d{5}/, "").trim() || "________";
  return `<div class="sig"><div>Luogo e data: ${esc(city)}, ${todayIt()}${extra ? "<br>" + extra : ""}</div><div>${esc(c.s.firma)}</div></div>`;
};
const head = (c: DocCtx, t: string, sub: string) => `<div class="sub">${esc(c.s.ragione)}${c.s.piva ? ` — P.IVA ${esc(c.s.piva)}` : ""}${c.s.sede ? ` — ${esc(c.s.sede)}` : ""}</div><h1>${t}</h1><div class="sub">${sub}</div>`;

export function schedaHtml(c: DocCtx, p: DbWorker) {
  const S = c.s, mesi = periodMonths(c.period);
  const inail = (p.area ?? "").toLowerCase().startsWith("uffic") ? S.inailU : S.inailP, k = 1 + (S.inps + inail + S.tfr) / 100;
  const stimato = p.employer_cost === null;
  const costo = p.employer_cost ?? p.base_pay * k;
  const annuo = (costo * 12) / mesi, oreRif = Math.round(S.ore * p.fte), coEff = p.hours_paid ? costo / p.hours_paid : 0, coRend = oreRif ? annuo / oreRif : 0;
  const of = p.training_hours ?? 0, imp = coRend * of;
  const lordo = costo / k, inps = (lordo * S.inps) / 100, ina = (lordo * inail) / 100, tfr = costo - lordo - inps - ina;
  const fte = p.fte.toFixed(2).replace(".", ",");
  return `<div class="doc">${head(c, "Scheda di rendicontazione del costo orario", `Personale in formazione finanziata — ${esc(S.fondo)}${S.avviso ? " · " + esc(S.avviso) : ""} — periodo dati ${periodoIt(c.period)}`)}
    <h2>1. Anagrafica e rapporto di lavoro</h2>${kv([["Nominativo", `<b>${esc(p.full_name ?? "")}</b>`], ["Matricola", esc(p.employee_code)], ["Funzione / mansione", `${esc(p.funzione)}${p.mansione ? " — " + esc(p.mansione) : ""}`], ["Struttura", esc(p.sede ?? "")], ["Livello di inquadramento", `${esc(S.ccnl)}${p.livello ? " — livello " + esc(p.livello) : ""}`], ["Impegno contrattuale (FTE)", `${fte} (${Math.round(p.fte * 100)}%)`]])}
    <h2>2. Costo del lavoro nel periodo</h2>${kv([["Periodo di riferimento", `${periodoIt(c.period)} (${mesi} mesi)`], ["Ore retribuite nel periodo", `${eur2(p.hours_paid).replace(/,00$/, "")} h`], ["Costo del lavoro nel periodo", E2(costo) + (stimato ? " <i>(stimato dalle aliquote: manca il costo aziendale nel file)</i>" : "")], ["Costo orario effettivo (costo ÷ ore)", `<b>${E2(coEff)} / h</b>`]])}
    <h2>3. Composizione del costo (stima)</h2>${tbl(["Voce", "Aliquota", "Importo"], [["Retribuzione lorda (incl. ratei ferie, 13ª e 14ª)", "—", E2(lordo)], ["Contributi previdenziali INPS a carico azienda", n1(S.inps) + "%", E2(inps)], ["Premio INAIL", n1(inail) + "%", E2(ina)], ["Accantonamento TFR", S.tfr.toLocaleString("it-IT") + "%", E2(tfr)], ["<b>Costo del lavoro nel periodo</b>", "", `<b>${E2(costo)}</b>`]], [1, 2])}
    <h2>4. Costo orario per la rendicontazione</h2>${kv([[`Costo del lavoro annuo lordo (periodo × 12/${mesi})`, E2(annuo)], [`Ore annue di riferimento (${eur0(S.ore)} h × FTE ${fte})`, `${eur0(oreRif)} h`], ["Costo orario rendicontabile", `<b>${E2(coRend)} / h</b>`], ["Confronto: costo orario effettivo", `${E2(coEff)} / h`]])}
    <p style="font-size:12px">Formula (opzione semplificata): costo orario = costo annuo lordo del lavoro ÷ ore annue di riferimento (${eur0(S.ore)} h per il tempo pieno, proporzionali al part-time). Il costo comprende retribuzione lorda, oneri contributivi e assistenziali a carico del datore e ratei.</p>
    <h2>5. Attività formativa e importo rendicontabile</h2>${p.training_title ? kv([["Attività formativa", esc(p.training_title)], ["Data di avvio", p.training_start ? new Date(p.training_start).toLocaleDateString("it-IT") : "—"], ["Ore di formazione svolte", `${of} h`], ["Costo orario rendicontabile", E2(coRend)], ["<b>Costo del personale in formazione</b>", `<b>${E2(imp)}</b>`]]) : "<p>Nessuna attività formativa finanziata registrata per questa persona nel periodo: nessun importo rendicontabile.</p>"}
    <h2>6. Documenti a supporto</h2><p style="font-size:12.5px">Cedolini e Libro Unico del Lavoro del periodo, contratto individuale, registro presenze della formazione firmato, attestato di frequenza. Metodo conforme all'opzione semplificata delle ${eur0(S.ore)} ore; per i fondi interprofessionali prevale quanto previsto dall'avviso${S.avviso ? ` (${esc(S.avviso)})` : ""}.</p>
    ${foot(c)}${sign(c, "Matricola " + esc(p.employee_code))}</div>`;
}

export function divarioHtml(c: DocCtx, ws: DbWorker[]) {
  const r = payGapReport(ws.map(toEngine)), ob = reportingObligation(r.headcount);
  const cadence = ob.required ? `${ob.frequency}, con primo rapporto entro il ${new Date(ob.firstDeadline!).toLocaleDateString("it-IT")}` : ob.note;
  const flag = (v: number | null) => (v !== null && Math.abs(v) >= 5 ? `<span class="flag">${pc(v)}</span>` : pc(v));
  const cats = r.categories.map(k => k.published
    ? [esc(k.category), `${k.n.F} / ${k.n.M}`, E2(k.meanHourly!.F), E2(k.meanHourly!.M), flag(k.gapMean), pc(k.gapMedian), pc(k.gapBaseMean), pc(k.gapVariableMean)]
    : [esc(k.category), `${k.n.F} / ${k.n.M}`, "—", "—", "n.d.", "n.d.", "n.d.", "n.d."]);
  const over = r.categories.filter(k => k.overThreshold);
  const expl = over.map(k => {
    const g = ws.filter(w => w.category === k.category), F = g.filter(w => w.gender === "F"), M = g.filter(w => w.gender === "M");
    const an = (l: DbWorker[]) => n1(mean(l.map(w => w.seniority_years ?? 0)));
    const pt = (l: DbWorker[]) => `${Math.round((l.filter(w => w.fte < 1).length / Math.max(1, l.length)) * 100)}%`;
    return [esc(k.category), `${an(F)} / ${an(M)}`, `${pt(F)} / ${pt(M)}`, pc(k.gapMean) + (k.gapMean! > 0 ? " (donne pagate meno)" : " (uomini pagati meno)")];
  });
  return `<div class="doc">${head(c, "Relazione sul divario retributivo di genere", `Direttiva (UE) 2023/970 sulla trasparenza retributiva — periodo ${periodoIt(c.period)}`)}
    <h2>1. Oggetto, metodo e perimetro</h2><p>La relazione riporta il divario retributivo di genere, calcolato come differenza tra il livello retributivo medio (e mediano) degli uomini e delle donne, in percentuale di quello degli uomini: un valore positivo indica che le donne sono pagate meno. Il livello retributivo è la <b>retribuzione lorda oraria</b> (retribuzione di base + componenti complementari o variabili, ÷ ore retribuite). Popolazione: ${r.headcount} lavoratori (${r.counted.F} donne, ${r.counted.M} uomini${r.excluded.notDeclared ? `, ${r.excluded.notDeclared} con genere non dichiarato esclusi dal calcolo` : ""}).</p>
    <p>Frequenza di comunicazione applicabile (${r.headcount} lavoratori): ${cadence}.</p>
    <h2>2. Indicatori complessivi (art. 9, par. 1)</h2>${tbl(["Indicatore", "Valore"], [["a) Divario retributivo medio", `<b>${pc(r.gapMean)}</b>`], ["b) Divario medio delle componenti variabili (tra chi le percepisce)", pc(r.gapVariableMean)], ["c) Divario retributivo mediano", `<b>${pc(r.gapMedian)}</b>`], ["d) Divario mediano delle componenti variabili", pc(r.gapVariableMedian)], ["e) Quota di donne / uomini che percepiscono componenti variabili", `${Math.round(r.variableRecipients.F)}% / ${Math.round(r.variableRecipients.M)}%`]], [1])}
    <h2>3. f) Distribuzione per quartili retributivi</h2>${tbl(["Quartile", "Persone", "% donne", "% uomini"], r.quartiles.map(q => [["Q1 — retribuzioni più basse", "Q2", "Q3", "Q4 — retribuzioni più alte"][q.index - 1]!, q.n, n1(q.shareF) + "%", n1(q.shareM) + "%"]), [1, 2, 3])}
    <h2>4. g) Divario per categoria di lavoratori (stesso lavoro o lavoro di pari valore)</h2>${tbl(["Categoria", "Donne / Uomini", "€/h donne", "€/h uomini", "Divario medio", "mediano", "solo base", "solo variabile"], cats, [1, 2, 3, 4, 5, 6, 7])}
    <p style="font-size:12px">In rosso i divari pari o superiori al 5%. Le categorie con meno di 3 persone per genere non sono valutate (n.d.) per tutela dell'anonimato e affidabilità statistica.</p>
    <h2>5. Categorie oltre la soglia del 5%</h2>${over.length ? `<p>${over.length} categoria/e con divario medio ≥ 5%. Fattori oggettivi disponibili nei dati:</p>${tbl(["Categoria", "Anzianità media D / U (anni)", "Part-time D / U", "Divario"], expl)}<p>Se il divario non è giustificato da criteri oggettivi e neutri rispetto al genere e non è corretto entro sei mesi dalla comunicazione, la Direttiva (art. 10) prevede una <b>valutazione congiunta delle retribuzioni</b> con le rappresentanze dei lavoratori.</p>` : "<p>Nessuna categoria valutabile supera la soglia del 5%: non è necessaria la valutazione congiunta.</p>"}
    <h2>6. Limiti e dati da integrare</h2><p style="font-size:12.5px">Le categorie di pari valore sono quelle indicate nel file caricato: devono derivare da un sistema di valutazione delle posizioni con criteri neutri (competenze, impegno, responsabilità, condizioni di lavoro). Verificare il decreto italiano di recepimento vigente prima della trasmissione.</p>
    ${foot(c)}${sign(c)}</div>`;
}

const RESP = (p: DbWorker) => /DIRETTORE|RESP\.|RESPONSABILE|CAPO|MANAGER/i.test(p.mansione ?? "") || /dirigente|quadro/i.test(p.livello ?? "");

export function paritaHtml(c: DocCtx, P: DbWorker[]) {
  const n = P.length, F = P.filter(p => p.gender === "F"), M = P.filter(p => p.gender === "M");
  const hF = F.map(hourly), hM = M.map(hourly);
  const qf = (F.length / Math.max(1, n)) * 100, resp = P.filter(RESP), respF = resp.filter(p => p.gender === "F").length;
  const share = (l: DbWorker[]) => (l.length ? n1((l.filter(p => p.gender === "F").length / l.length) * 100) + "%" : "—");
  const byArea = [...new Set(P.map(p => p.area ?? "—"))].sort().map(a => { const l = P.filter(p => (p.area ?? "—") === a); return [esc(a), l.length, share(l)]; });
  const byLiv = [...new Set(P.map(p => p.livello ?? "—"))].sort().map(v => { const l = P.filter(p => (p.livello ?? "—") === v); return [esc(v), l.length, share(l)]; });
  const fF = F.filter(p => p.training_title), fM = M.filter(p => p.training_title);
  const over = payGapReport(P.map(toEngine)).jointAssessmentCandidates;
  const area = (k: string, t: string, w: number, body: string, ev: string) => `<h2>${k}. ${t} <span style="font-weight:normal;color:#666">— peso ${w}%</span></h2>${body}<p style="font-size:12px"><b>Evidenze da allegare:</b> ${ev}</p>`;
  return `<div class="doc">${head(c, "Dossier per la certificazione della parità di genere", `Prassi di riferimento UNI/PdR 125:2022 — dati di base, periodo ${periodoIt(c.period)}`)}
    <h2>Anagrafica e perimetro</h2>${kv([["Lavoratori in organico", n], ["Donne / uomini", `${F.length} / ${M.length}`], ["Quota femminile", n1(qf) + "%"], ["Sedi / funzioni / mansioni", `${new Set(P.map(p => p.sede)).size} / ${new Set(P.map(p => p.funzione)).size} / ${new Set(P.map(p => p.mansione)).size}`], ["Fascia dimensionale", n >= 250 ? "Grande impresa" : n >= 50 ? "Media impresa" : "Piccola impresa"]])}
    ${area("1", "Cultura e strategia", 15, "<p>Area qualitativa: non calcolabile dai dati.</p>", "politica per la parità approvata dalla direzione, obiettivi e indicatori nel piano strategico, piano di comunicazione interna ed esterna.")}
    ${area("2", "Governance", 15, kv([["Ruoli di responsabilità (direzione, responsabili, capi, quadri)", resp.length], ["Donne nei ruoli di responsabilità", `${respF} (${n1((respF / Math.max(1, resp.length)) * 100)}%)`], ["Confronto con la quota femminile totale", n1(qf) + "%"]]), "comitato guida per la parità, ruoli e responsabilità formalizzati, budget dedicato.")}
    ${area("3", "Processi HR", 10, tbl(["Area", "Persone", "% donne"], byArea, [1, 2]) + '<p style="font-size:12px">La distribuzione per area evidenzia la segregazione orizzontale.</p>', "procedure di selezione e valutazione neutre rispetto al genere, criteri di progressione documentati.")}
    ${area("4", "Opportunità di crescita e inclusione delle donne", 20, tbl(["Livello di inquadramento", "Persone", "% donne"], byLiv, [1, 2]) + kv([["Anzianità media donne / uomini", `${n1(mean(F.map(p => p.seniority_years ?? 0)))} / ${n1(mean(M.map(p => p.seniority_years ?? 0)))} anni`], ["Persone coinvolte in formazione finanziata", `donne ${Math.round((fF.length / Math.max(1, F.length)) * 100)}% · uomini ${Math.round((fM.length / Math.max(1, M.length)) * 100)}%`], ["Ore medie di formazione per persona formata", `donne ${n1(mean(fF.map(p => p.training_hours ?? 0)) || 0)} h · uomini ${n1(mean(fM.map(p => p.training_hours ?? 0)) || 0)} h`]]), "piani di sviluppo e formazione per genere, dati sulle promozioni per genere.")}
    ${area("5", "Equità remunerativa per genere", 20, kv([["Divario retributivo medio (M−F)/M", pc(gapPct(mean(hF), mean(hM)))], ["Divario retributivo mediano", pc(gapPct(median(hF), median(hM)))], ["Categorie con divario ≥ 5%", over.length ? esc(over.join(", ")) : "nessuna"]]), "politica retributiva e premi per genere, RAL contrattuale per livello.")}
    ${area("6", "Tutela della genitorialità e conciliazione vita-lavoro", 20, "<p>Dati non presenti (rientri dopo maternità/paternità, congedi per genere, flessibilità): da raccogliere.</p>", "rientri post-maternità e paternità, congedi fruiti per genere, strumenti di flessibilità e welfare.")}
    <h2>Soglia di certificazione</h2><p style="font-size:12.5px">La certificazione UNI/PdR 125:2022, rilasciata da organismo accreditato, richiede almeno il 60% del punteggio complessivo e, ove ricorrano i requisiti, dà accesso allo sgravio contributivo (fino all'1%, massimo € 50.000 annui) e a premialità nei bandi pubblici. Le aree 1 e 6 e le evidenze documentali vanno integrate dall'azienda.</p>
    ${foot(c)}${sign(c, "Referente parità: ______________")}</div>`;
}

const STYLE = `@page{size:A4;margin:2cm}body{font:11pt/1.5 Georgia,'Times New Roman',serif;color:#1a1a1a;background:#fff}h1{font:bold 18pt Arial,sans-serif;margin:.2em 0}h2{font:bold 11.5pt Arial,sans-serif;border-bottom:1px solid #999;padding-bottom:2px;margin:1.2em 0 .4em}.sub{color:#555;font-size:10pt}table{border-collapse:collapse;width:100%;margin:4px 0 8px;font-size:10pt}th,td{border:1px solid #999;padding:4px 7px;text-align:left;vertical-align:top}th{background:#eee}td.n,th.n{text-align:right}.flag{color:#b03a2e;font-weight:bold}.foot{font-size:9pt;color:#555;border-top:1px solid #999;margin-top:14px;padding-top:6px}.sig{width:100%;margin-top:30px;font-size:10pt}.sig div{display:inline-block;width:48%;vertical-align:top}.sig div:last-child{border-top:1px solid #333;text-align:center;padding-top:3px}.doc{page-break-after:always}.doc:last-child{page-break-after:auto}@media screen{body{max-width:21cm;margin:1.5cm auto;padding:0 1cm}}`;

export const wrapDoc = (name: string, inner: string, print = false) =>
  `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${esc(name)}</title><style>${STYLE}</style></head><body>${inner}${print ? "<script>addEventListener('load',()=>print())</script>" : ""}</body></html>`;

export const slug = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "");
