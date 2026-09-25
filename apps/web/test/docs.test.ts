import { describe, expect, it } from "vitest";
import type { DbWorker } from "@/app/periodi/[id]/data";
import { divarioHtml, paritaHtml, schedaHtml, type DocCtx } from "@/lib/docs";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import demo from "@/lib/demo.json";

const ws: DbWorker[] = demo.rows.map((r, i) => ({
  id: `w${i}`, employee_code: r.id, full_name: r.fullName, gender: r.gender as "F" | "M", category: r.category, funzione: r.funzione, mansione: r.mansione,
  sede: r.sede, area: r.area, livello: r.livello, fte: r.fte, hours_paid: r.hoursPaid, base_pay: r.basePay, variable_pay: r.variablePay,
  employer_cost: r.employerCost, seniority_years: r.seniorityYears, training_title: r.trainingTitle ?? null, training_hours: r.trainingHours ?? null,
  training_start: r.trainingStart ? r.trainingStart.split("/").reverse().join("-") : null,
}));
const ctx: DocCtx = { s: { ...DEFAULT_SETTINGS, ragione: "Azienda Prova S.p.A.", sede: "Via Roma 1, 20100 Milano" }, period: { id: "p", label: "H1 2026", starts_on: "2026-01-01", ends_on: "2026-06-30" }, version: "0.1.0" };

describe("documenti", () => {
  it("scheda di formazione: costo orario = costo annuo ÷ (1.720 h × FTE)", () => {
    const p = ws.find(w => w.training_title && w.fte === 1)!;
    const h = schedaHtml(ctx, p);
    const atteso = ((p.employer_cost! * 2) / 1720).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    expect(h).toContain(`<b>€ ${atteso} / h</b>`);
    expect(h).toContain("Milano");
    expect(h).toContain(p.training_title!);
  });
  it("relazione sul divario: 7 indicatori e obbligo per 180 lavoratori", () => {
    const h = divarioHtml(ctx, ws);
    for (const k of ["a) Divario retributivo medio", "b) Divario medio delle componenti", "c) Divario retributivo mediano", "d) Divario mediano", "e) Quota", "f) Distribuzione per quartili", "g) Divario per categoria"]) expect(h).toContain(k);
    expect(h).toContain("triennale, con primo rapporto entro il 07/06/2027");
  });
  it("dossier parità: 6 aree UNI/PdR 125", () => {
    const h = paritaHtml(ctx, ws);
    expect(h.match(/— peso \d+%/g)).toHaveLength(6);
    expect(h).toContain("Media impresa");
  });
  it("i testi inseriti dagli utenti vengono resi innocui", () => {
    const h = schedaHtml({ ...ctx, s: { ...ctx.s, ragione: "<script>x</script>" } }, ws[0]!);
    expect(h).not.toContain("<script>x");
  });
});

describe("documento piano d'azione", () => {
  it("riepilogo, calendario e schede, testi resi innocui", async () => {
    const { pianoHtml } = await import("@/lib/docs");
    const items = [
      { priority: "Critica", area: "Dati e privacy", title: "DPIA <b>x</b>", why: "perché", steps: ["uno", "due"], rif: "GDPR art. 35", owner: "DPO", dueEff: "2026-10-25", late: false, state: null },
      { priority: "Alta", area: "Trasparenza", title: "Annunci", why: "w", steps: ["a"], owner: "HR", dueEff: "2026-09-01", late: true, state: { status: "In corso", owner: "Maria", note: "ok" } },
    ];
    const h = pianoHtml(ctx, items, d => (d < "2026-11-01" ? "Subito (entro 30 giorni)" : "Entro 3 mesi"), ["Subito (entro 30 giorni)", "Entro 3 mesi"]);
    expect(h).toContain("Piano d'azione");
    expect(h).toContain("in ritardo");
    expect(h).toContain("Maria");
    expect(h).not.toContain("<b>x</b>");
    expect(h.match(/<ol/g)).toHaveLength(2);
  });
});
