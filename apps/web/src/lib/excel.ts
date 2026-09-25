import "server-only";
import ExcelJS from "exceljs";
import type { Worker } from "@g1g10/engine";

/** Colonne del modello Excel, nello stesso ordine del foglio. `key` = campo del modello dati del motore. */
export const COLUMNS = [
  { key: "id", head: "Matricola", req: true, help: "Codice univoco del dipendente" },
  { key: "fullName", head: "Nominativo", req: false, help: "Facoltativo: non serve al calcolo del divario" },
  { key: "gender", head: "Genere", req: true, help: "F, M oppure ND (non dichiarato)" },
  { key: "category", head: "Categoria pari valore", req: true, help: "Gruppo di lavori di pari valore (pesatura posizioni). Se non c'è, ripetere la funzione" },
  { key: "funzione", head: "Funzione", req: true, help: "Es. PRODUZIONE, AMMINISTRAZIONE" },
  { key: "mansione", head: "Mansione", req: false, help: "" },
  { key: "sede", head: "Sede", req: false, help: "" },
  { key: "area", head: "Area", req: false, help: "" },
  { key: "livello", head: "Livello CCNL", req: false, help: "" },
  { key: "fte", head: "FTE", req: true, help: "1 = tempo pieno, 0,5 = metà tempo" },
  { key: "hoursPaid", head: "Ore retribuite", req: true, help: "Ore pagate nel periodo, straordinari inclusi" },
  { key: "basePay", head: "Retribuzione base lorda €", req: true, help: "Retribuzione ordinaria lorda del periodo" },
  { key: "variablePay", head: "Componenti variabili €", req: false, help: "Premi, bonus, indennità, fringe benefit del periodo (0 se nessuno)" },
  { key: "employerCost", head: "Costo aziendale €", req: false, help: "Facoltativo: retribuzione + oneri" },
  { key: "seniorityYears", head: "Anzianità anni", req: false, help: "" },
] as const;

const NUM = new Set(["fte", "hoursPaid", "basePay", "variablePay", "employerCost", "seniorityYears"]);

export type ImportedWorker = Worker & { fullName?: string };
export interface RowIssue { row: number | null; id: string | null; message: string; severity: "errore" | "avviso" }

export async function templateWorkbook(rows: Record<string, string | number>[] = []) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Segnali d'uscita · G1G10";
  const ws = wb.addWorksheet("Dati", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = COLUMNS.map(c => ({ header: c.head + (c.req ? " *" : ""), key: c.key, width: Math.max(14, c.head.length + 4) }));
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF714B67" } };
  rows.forEach(r => ws.addRow(r));
  const guide = wb.addWorksheet("Istruzioni");
  guide.columns = [{ header: "Colonna", width: 28 }, { header: "Obbligatoria", width: 14 }, { header: "Cosa inserire", width: 80 }];
  guide.getRow(1).font = { bold: true };
  COLUMNS.forEach(c => guide.addRow([c.head, c.req ? "sì" : "no", c.help]));
  guide.addRow([]);
  guide.addRow(["Periodo", "", "Tutti gli importi e le ore si riferiscono allo stesso periodo (es. anno solare)."]);
  guide.addRow(["Ricaricamento", "", "Caricare un nuovo file per lo stesso periodo sostituisce i dati precedenti."]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const norm = (s: string) => s.toLowerCase().replace(/\*/g, "").replace(/[^a-z0-9àèéìòù]+/g, " ").trim();

/** Numero in formato italiano o internazionale: 1.234,56 · 1234.56 · 1234 */
function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return v;
  if (typeof v === "object" && v && "result" in v) return toNumber((v as { result: unknown }).result);
  let s = String(v).replace(/[€\s]/g, "");
  if (/,\d{1,2}$/.test(s) || (s.includes(",") && !s.includes("."))) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

const cellText = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && "richText" in (v as object)) return (v as { richText: { text: string }[] }).richText.map(t => t.text).join("");
  if (typeof v === "object" && "result" in (v as object)) return String((v as { result: unknown }).result ?? "");
  return String(v).trim();
};

export async function parseWorkbook(buf: ArrayBuffer): Promise<{ workers: ImportedWorker[]; issues: RowIssue[] }> {
  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(buf); }
  catch { return { workers: [], issues: [{ row: null, id: null, severity: "errore", message: "Il file non è un Excel (.xlsx) leggibile." }] }; }
  const ws = wb.getWorksheet("Dati") ?? wb.worksheets[0];
  if (!ws) return { workers: [], issues: [{ row: null, id: null, severity: "errore", message: "Il file non contiene fogli." }] };

  const issues: RowIssue[] = [];
  const header = ws.getRow(1);
  const colOf = new Map<string, number>();
  header.eachCell((cell, col) => {
    const h = norm(cellText(cell.value));
    const c = COLUMNS.find(c => norm(c.head) === h);
    if (c) colOf.set(c.key, col);
  });
  const missing = COLUMNS.filter(c => c.req && !colOf.has(c.key)).map(c => c.head);
  if (missing.length) return { workers: [], issues: [{ row: 1, id: null, severity: "errore", message: `Colonne obbligatorie mancanti: ${missing.join(", ")}. Usare il modello scaricabile.` }] };

  const workers: ImportedWorker[] = [];
  ws.eachRow((row, r) => {
    if (r === 1) return;
    const get = (k: string) => { const c = colOf.get(k); return c ? row.getCell(c).value : null; };
    if (COLUMNS.every(c => !cellText(get(c.key)))) return; // riga vuota
    const w: Record<string, unknown> = {};
    for (const c of COLUMNS) {
      const raw = get(c.key);
      if (NUM.has(c.key)) {
        const n = toNumber(raw);
        if (Number.isNaN(n)) issues.push({ row: r, id: cellText(get("id")) || null, severity: "errore", message: `"${c.head}": valore non numerico (${cellText(raw)}).` });
        w[c.key] = n ?? (c.key === "variablePay" ? 0 : undefined);
      } else w[c.key] = cellText(raw) || undefined;
    }
    w.gender = String(w.gender ?? "").toUpperCase();
    for (const c of COLUMNS) if (c.req && (w[c.key] === undefined || w[c.key] === "")) issues.push({ row: r, id: (w.id as string) ?? null, severity: "errore", message: `"${c.head}" mancante.` });
    workers.push(w as unknown as ImportedWorker);
  });
  if (!workers.length) issues.push({ row: null, id: null, severity: "errore", message: "Nessuna riga di dati trovata nel foglio." });
  return { workers, issues };
}
