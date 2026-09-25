import "server-only";
import ExcelJS from "exceljs";
import type { RiskFactors, Worker } from "@g1g10/engine";
import { FACTORS } from "./factors";

/** Foglio "Dati": colonne nello stesso ordine del foglio. `key` = campo del modello dati del motore. */
export const COLUMNS = [
  { key: "id", head: "Matricola", req: true, help: "Codice univoco del dipendente" },
  { key: "fullName", head: "Nominativo", req: false, help: "Facoltativo: non serve al calcolo del divario" },
  { key: "gender", head: "Genere", req: true, help: "F, M oppure ND (non dichiarato)" },
  { key: "category", head: "Categoria pari valore", req: true, help: "Stesso lavoro o lavoro di pari valore (D.Lgs. 96/2026 art. 4): di norma il livello di inquadramento del CCNL, es. «C3 impiegati»" },
  { key: "funzione", head: "Funzione", req: true, help: "Es. PRODUZIONE, AMMINISTRAZIONE" },
  { key: "mansione", head: "Mansione", req: false, help: "" },
  { key: "sede", head: "Sede", req: false, help: "" },
  { key: "area", head: "Area", req: false, help: "Es. Uffici, Produzione, Logistica" },
  { key: "livello", head: "Livello CCNL", req: false, help: "" },
  { key: "fte", head: "FTE", req: true, help: "1 = tempo pieno, 0,5 = metà tempo" },
  { key: "hoursPaid", head: "Ore retribuite", req: true, help: "Ore pagate nel periodo, straordinari inclusi" },
  { key: "basePay", head: "Retribuzione base lorda €", req: true, help: "Elementi FISSI E CONTINUATIVI del periodo (minimo, contingenza, scatti, superminimi, indennità fisse): è il «livello retributivo» del D.Lgs. 96/2026 art. 3" },
  { key: "variablePay", head: "Componenti variabili €", req: false, help: "Componenti complementari o variabili e trattamenti individuali non strutturali: premi, bonus, una tantum, fringe benefit (0 se nessuno)" },
  { key: "employerCost", head: "Costo aziendale €", req: false, help: "Retribuzione + oneri del periodo: serve alla scheda di formazione finanziata" },
  { key: "seniorityYears", head: "Anzianità anni", req: false, help: "" },
  { key: "trainingTitle", head: "Formazione titolo", req: false, help: "Corso di formazione finanziata svolto nel periodo" },
  { key: "trainingHours", head: "Formazione ore", req: false, help: "" },
  { key: "trainingStart", head: "Formazione avvio", req: false, help: "Data di avvio (gg/mm/aaaa)" },
] as const;

const NUM = new Set(["fte", "hoursPaid", "basePay", "variablePay", "employerCost", "seniorityYears", "trainingHours"]);

export type ImportedWorker = Worker & {
  fullName?: string; mansione?: string; sede?: string; area?: string; livello?: string; employerCost?: number; seniorityYears?: number;
  trainingTitle?: string; trainingHours?: number; trainingStart?: string;
};
export interface RowIssue { row: number | null; id: string | null; message: string; severity: "errore" | "avviso"; sheet?: string }
export interface Parsed { workers: ImportedWorker[]; factors: Map<string, RiskFactors>; market: { funzione: string; annual_pay: number }[]; issues: RowIssue[] }

type Row = Record<string, string | number | null | undefined | Date>;

const head = (ws: ExcelJS.Worksheet) => {
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF714B67" } };
};

export async function templateWorkbook(data: { rows?: Row[]; factors?: Row[]; market?: Row[] } = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Segnali d'uscita · G1G10";
  const ws = wb.addWorksheet("Dati", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = COLUMNS.map(c => ({ header: c.head + (c.req ? " *" : ""), key: c.key, width: Math.max(14, c.head.length + 4) }));
  head(ws);
  (data.rows ?? []).forEach(r => ws.addRow(r));

  const fs = wb.addWorksheet("Fattori rischio", { views: [{ state: "frozen", ySplit: 1 }] });
  fs.columns = [{ header: "Matricola *", key: "id", width: 14 }, ...FACTORS.map(f => ({ header: f.head, key: f.key, width: Math.max(14, f.head.length + 2) }))];
  head(fs);
  (data.factors ?? []).forEach(r => fs.addRow(r));
  // menu a tendina con i valori ammessi
  const last = Math.max(300, (data.factors?.length ?? 0) + 50);
  FACTORS.forEach((f, i) => {
    const validation = { type: "list" as const, allowBlank: true, formulae: [`"${f.opts.map(o => o[1]).join(",")}"`] };
    for (let r = 2; r <= last; r++) fs.getCell(r, i + 2).dataValidation = validation;
  });

  const ms = wb.addWorksheet("Mercato");
  ms.columns = [{ header: "Funzione *", key: "funzione", width: 30 }, { header: "RAL media di mercato € *", key: "annual_pay", width: 26 }];
  head(ms);
  (data.market ?? []).forEach(r => ms.addRow(r));

  const guide = wb.addWorksheet("Istruzioni");
  guide.columns = [{ header: "Colonna", width: 28 }, { header: "Obbligatoria", width: 14 }, { header: "Cosa inserire", width: 90 }];
  guide.getRow(1).font = { bold: true };
  guide.addRow(["FOGLIO «Dati»", "", "Una riga per persona. Tutti gli importi e le ore si riferiscono allo stesso periodo."]);
  COLUMNS.forEach(c => guide.addRow([c.head, c.req ? "sì" : "no", c.help]));
  guide.addRow([]);
  guide.addRow(["FOGLIO «Fattori rischio»", "facoltativo", "Solo chi ha il ruolo HR rischio può caricarlo. Una riga per matricola; scegliere i valori dal menu a tendina."]);
  guide.addRow(["FOGLIO «Mercato»", "facoltativo", "RAL media di mercato per funzione: serve a confrontare le retribuzioni con il mercato."]);
  guide.addRow(["Ricaricamento", "", "Un nuovo file per lo stesso periodo aggiorna le persone presenti (casi e valutazioni restano) e toglie quelle non più presenti."]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const norm = (s: string) => s.toLowerCase().replace(/\*/g, "").replace(/[–—]/g, "-").replace(/[^a-z0-9àèéìòù-]+/g, " ").trim();

/** Numero in formato italiano o internazionale: 1.234,56 · 1234.56 · 1234 */
function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return v;
  if (typeof v === "object" && v && "result" in v) return toNumber((v as { result: unknown }).result);
  let s = String(v).replace(/[€\s]/g, "");
  // 35.000 · 1.234.567,89 → migliaia all'italiana; 1,234.56 → migliaia all'inglese
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s) || /,\d{1,2}$/.test(s) || (s.includes(",") && !s.includes("."))) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function toDate(v: unknown): string | null | undefined {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const m = String(v).trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/) ?? null;
  if (m) return `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v).trim()) ? String(v).trim() : undefined;
}

const cellText = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && "richText" in (v as object)) return (v as { richText: { text: string }[] }).richText.map(t => t.text).join("");
  if (typeof v === "object" && "result" in (v as object)) return String((v as { result: unknown }).result ?? "");
  return String(v).trim();
};

const sheet = (wb: ExcelJS.Workbook, name: string) => wb.worksheets.find(w => norm(w.name) === norm(name));

function headerMap(ws: ExcelJS.Worksheet, heads: { key: string; head: string }[]) {
  const colOf = new Map<string, number>();
  ws.getRow(1).eachCell((cell, col) => {
    const h = norm(cellText(cell.value));
    const c = heads.find(c => norm(c.head) === h);
    if (c) colOf.set(c.key, col);
  });
  return colOf;
}

export async function parseWorkbook(buf: ArrayBuffer): Promise<Parsed> {
  const empty = { workers: [], factors: new Map(), market: [] };
  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(buf); }
  catch { return { ...empty, issues: [{ row: null, id: null, severity: "errore", message: "Il file non è un Excel (.xlsx) leggibile." }] }; }
  const ws = sheet(wb, "Dati") ?? wb.worksheets[0];
  if (!ws) return { ...empty, issues: [{ row: null, id: null, severity: "errore", message: "Il file non contiene fogli." }] };

  const issues: RowIssue[] = [];
  const colOf = headerMap(ws, [...COLUMNS]);
  const missing = COLUMNS.filter(c => c.req && !colOf.has(c.key)).map(c => c.head);
  if (missing.length) return { ...empty, issues: [{ row: 1, id: null, severity: "errore", message: `Colonne obbligatorie mancanti: ${missing.join(", ")}. Usare il modello scaricabile.` }] };

  const workers: ImportedWorker[] = [];
  ws.eachRow((row, r) => {
    if (r === 1) return;
    const get = (k: string) => { const c = colOf.get(k); return c ? row.getCell(c).value : null; };
    if (COLUMNS.every(c => !cellText(get(c.key)))) return; // riga vuota
    const w: Record<string, unknown> = {};
    const id = cellText(get("id")) || null;
    for (const c of COLUMNS) {
      const raw = get(c.key);
      if (NUM.has(c.key)) {
        const n = toNumber(raw);
        if (Number.isNaN(n)) issues.push({ row: r, id, severity: "errore", message: `"${c.head}": valore non numerico (${cellText(raw)}).` });
        w[c.key] = n ?? (c.key === "variablePay" ? 0 : undefined);
      } else if (c.key === "trainingStart") {
        const d = toDate(raw);
        if (d === undefined) issues.push({ row: r, id, severity: "errore", message: `"${c.head}": data non valida (${cellText(raw)}), usare gg/mm/aaaa.` });
        w[c.key] = d ?? undefined;
      } else w[c.key] = cellText(raw) || undefined;
    }
    w.gender = String(w.gender ?? "").toUpperCase();
    for (const c of COLUMNS) if (c.req && (w[c.key] === undefined || w[c.key] === "")) issues.push({ row: r, id, severity: "errore", message: `"${c.head}" mancante.` });
    workers.push(w as unknown as ImportedWorker);
  });
  if (!workers.length) issues.push({ row: null, id: null, severity: "errore", message: "Nessuna riga di dati trovata nel foglio." });

  // Fattori di rischio (facoltativo)
  const factors = new Map<string, RiskFactors>();
  const fs = sheet(wb, "Fattori rischio");
  if (fs) {
    const fc = headerMap(fs, [{ key: "id", head: "Matricola" }, ...FACTORS.map(f => ({ key: f.key, head: f.head }))]);
    const known = new Set(workers.map(w => w.id));
    fs.eachRow((row, r) => {
      if (r === 1) return;
      const id = cellText(row.getCell(fc.get("id") ?? 1).value);
      const filled = FACTORS.filter(f => fc.has(f.key) && cellText(row.getCell(fc.get(f.key)!).value));
      if (!id && !filled.length) return;
      if (!known.has(id)) { issues.push({ row: r, id: id || null, sheet: "Fattori rischio", severity: "errore", message: "Matricola non presente nel foglio Dati." }); return; }
      const f: Record<string, number> = { sat: 3, load: 3, promo: 0, extra: 0, recog: 0, behav: 0, mobil: 0, market: 0, perf: 1, crit: 1 };
      for (const d of FACTORS) {
        const c = fc.get(d.key); if (!c) continue;
        const t = cellText(row.getCell(c).value); if (!t) continue;
        const o = d.opts.find(([v, l]) => norm(l) === norm(t) || String(v) === t);
        if (!o) issues.push({ row: r, id, sheet: "Fattori rischio", severity: "errore", message: `"${d.head}": valore "${t}" non previsto (ammessi: ${d.opts.map(x => x[1]).join(", ")}).` });
        else f[d.key] = o[0];
      }
      factors.set(id, f as unknown as RiskFactors);
    });
  }

  // Mercato (facoltativo)
  const market: { funzione: string; annual_pay: number }[] = [];
  const ms = sheet(wb, "Mercato");
  if (ms) {
    const mc = headerMap(ms, [{ key: "funzione", head: "Funzione" }, { key: "annual_pay", head: "RAL media di mercato €" }]);
    ms.eachRow((row, r) => {
      if (r === 1) return;
      const fn = cellText(row.getCell(mc.get("funzione") ?? 1).value), pay = toNumber(row.getCell(mc.get("annual_pay") ?? 2).value);
      if (!fn && pay === null) return;
      if (!fn || !pay || Number.isNaN(pay) || pay <= 0) issues.push({ row: r, id: null, sheet: "Mercato", severity: "errore", message: "Serve funzione e RAL di mercato maggiore di zero." });
      else if (market.some(m => m.funzione === fn)) issues.push({ row: r, id: null, sheet: "Mercato", severity: "errore", message: `Funzione "${fn}" ripetuta.` });
      else market.push({ funzione: fn, annual_pay: pay });
    });
  }
  return { workers, factors, market, issues };
}
