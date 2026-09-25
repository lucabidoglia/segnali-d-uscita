import { describe, expect, it } from "vitest";
import { BENCH, DIMENSIONS, MARKET_CHOICES, table } from "@/lib/benchmarks";

describe("medie di mercato", () => {
  it("ogni valore ha una fonte documentata", () => {
    for (const r of BENCH.rows) expect(BENCH.sources[r.source], r.source).toBeDefined();
  });
  it("copre le dimensioni richieste", () => {
    for (const d of ["Area geografica", "Sesso", "Età", "Professione (ISCO)", "Qualifica", "Dimensione azienda", "Settore (Ateco)", "CCNL Metalmeccanici Industria", "CCNL Terziario Confcommercio"]) expect(DIMENSIONS).toContain(d);
  });
  it("valori coerenti con le pubblicazioni ufficiali", () => {
    expect(table("Qualifica", "annuo", "inps").find(r => r.group === "Quadri")?.T).toBe(72279);
    expect(table("Settore (Ateco)", "orario", "eurostat").find(r => r.group.startsWith("K "))?.T).toBeCloseTo(25.9, 1); // ISTAT: 25,9 €/h
    expect(table("Dimensione azienda", "orario", "eurostat").find(r => r.group.startsWith("10–49"))?.T).toBeCloseTo(12.8, 0); // ISTAT: 12,8 €/h
  });
  it("riferimenti per il foglio Mercato: professione × dimensione", () => {
    expect(MARKET_CHOICES.length).toBeGreaterThan(20);
    expect(MARKET_CHOICES.every(c => c.hourly > 5 && c.hourly < 80)).toBe(true);
  });
});
