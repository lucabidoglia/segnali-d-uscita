import data from "./benchmarks.json";

/** Medie di mercato ufficiali (generate da scripts/make-benchmarks.mjs). */
export interface Bench { source: string; dimension: string; group: string; sex: "T" | "F" | "M"; measure: string; value: number; days?: number; isco?: string; size?: string }
export const BENCH = data as unknown as { generated: string; sources: Record<string, { name: string; year: number; url: string; note: string }>; rows: Bench[] };

export const DIMENSIONS = [...new Set(BENCH.rows.map(r => r.dimension))];

/** Una riga per gruppo con donne, uomini e totale affiancati. */
export function table(dimension: string, measure: string, source: string) {
  const m = new Map<string, { group: string; T?: number; F?: number; M?: number; days?: number }>();
  for (const r of BENCH.rows) {
    if (r.dimension !== dimension || r.measure !== measure || r.source !== source) continue;
    const row = m.get(r.group) ?? { group: r.group };
    row[r.sex] = r.value;
    if (r.days) row.days = r.days;
    m.set(r.group, row);
  }
  return [...m.values()];
}

/** Riferimenti per il foglio «Mercato»: retribuzione oraria per professione × dimensione azienda (Eurostat 2022). */
export const MARKET_CHOICES = BENCH.rows
  .filter(r => r.dimension === "Professione × dimensione" && r.measure === "orario" && r.sex === "T")
  .map(r => ({ key: `${r.isco}|${r.size}`, label: r.group, hourly: r.value }));
