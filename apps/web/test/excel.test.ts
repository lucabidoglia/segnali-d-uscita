import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { payGapReport, validateWorkers } from "@g1g10/engine";
import { parseWorkbook, templateWorkbook } from "@/lib/excel";
import demo from "@/lib/demo.json";

const ab = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

describe("import Excel", () => {
  it("l'esempio con 180 persone inventate si rilegge senza errori e produce il report", async () => {
    const { workers, issues, factors, market } = await parseWorkbook(ab(await templateWorkbook(demo)));
    expect(issues).toEqual([]);
    expect(workers).toHaveLength(180);
    expect(factors.size).toBe(180);
    expect(market).toHaveLength(12);
    expect(workers.filter(w => w.trainingTitle).length).toBeGreaterThan(100);
    expect(validateWorkers(workers).filter(i => i.severity === "errore")).toEqual([]);
    const r = payGapReport(workers);
    expect(r.counted.F + r.counted.M).toBe(180);
    expect(r.gapMean).not.toBeNull();
  });

  it("il modello vuoto viene scartato con un messaggio chiaro", async () => {
    const { issues } = await parseWorkbook(ab(await templateWorkbook()));
    expect(issues[0]!.message).toMatch(/Nessuna riga/);
  });

  it("accetta numeri scritti all'italiana e segnala celle sbagliate con il numero di riga", async () => {
    const buf = await templateWorkbook({ rows: [
      { id: "A1", gender: "f", category: "X", funzione: "X", fte: "0,5", hoursPaid: "1.720", basePay: "12.345,67", variablePay: "" },
      { id: "A2", gender: "M", category: "X", funzione: "X", fte: 1, hoursPaid: "tante", basePay: 20000 },
      { id: "A3", gender: "M", category: "", funzione: "X", fte: 1, hoursPaid: 1720, basePay: 30000 },
    ] });
    const { workers, issues } = await parseWorkbook(ab(buf));
    expect(workers[0]).toMatchObject({ gender: "F", fte: 0.5, hoursPaid: 1720, basePay: 12345.67, variablePay: 0 });
    expect(issues.map(i => [i.row, i.message])).toEqual([
      [3, '"Ore retribuite": valore non numerico (tante).'],
      [4, '"Categoria pari valore" mancante.'],
    ]);
  });

  it("riconosce le colonne anche senza asterisco e in ordine diverso", async () => {
    const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet("Foglio1");
    ws.addRow(["Retribuzione base lorda €", "matricola", "GENERE", "Funzione", "Categoria pari valore", "FTE", "Ore retribuite"]);
    ws.addRow([30000, "Z9", "M", "IT", "IT", 1, 1720]);
    const { workers, issues } = await parseWorkbook(ab(Buffer.from(await wb.xlsx.writeBuffer())));
    expect(issues).toEqual([]);
    expect(workers[0]).toMatchObject({ id: "Z9", basePay: 30000, hoursPaid: 1720 });
  });

  it("colonne obbligatorie mancanti o file non Excel → errore bloccante", async () => {
    const wb = new ExcelJS.Workbook(); wb.addWorksheet("Dati").addRow(["Matricola", "Genere"]);
    expect((await parseWorkbook(ab(Buffer.from(await wb.xlsx.writeBuffer())))).issues[0]!.message).toMatch(/Colonne obbligatorie mancanti: Categoria/);
    expect((await parseWorkbook(new TextEncoder().encode("ciao").buffer as ArrayBuffer)).issues[0]!.message).toMatch(/non è un Excel/);
  });

  it("fattori di rischio: valori dal menu, errori per valori non previsti o matricole sconosciute", async () => {
    const { factors, issues } = await parseWorkbook(ab(await templateWorkbook({
      rows: [{ id: "A1", gender: "F", category: "X", funzione: "X", fte: 1, hoursPaid: 1720, basePay: 30000 }],
      factors: [{ id: "A1", sat: "2", promo: "Bloccata", behav: "disimpegno" }, { id: "ZZ", sat: "1" }, { id: "A1", extra: "Tantissimi" }],
    })));
    expect(factors.get("A1")).toMatchObject({ load: 3, perf: 1 });
    expect(issues.map(i => i.message)).toEqual(["Matricola non presente nel foglio Dati.", '"Straordinari": valore "Tantissimi" non previsto (ammessi: Normali, Elevati, Molto elevati).']);
  });

  it("mercato: RAL per funzione, niente doppioni", async () => {
    const { market, issues } = await parseWorkbook(ab(await templateWorkbook({
      rows: [{ id: "A1", gender: "F", category: "X", funzione: "X", fte: 1, hoursPaid: 1720, basePay: 30000 }],
      market: [{ funzione: "X", annual_pay: "35.000" }, { funzione: "X", annual_pay: 1 }],
    })));
    expect(market).toEqual([{ funzione: "X", annual_pay: 35000 }]);
    expect(issues[0]!.message).toMatch(/ripetuta/);
  });
});
