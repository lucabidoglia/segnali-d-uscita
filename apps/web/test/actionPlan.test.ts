import { describe, expect, it } from "vitest";
import { payGapReport, type Worker } from "@g1g10/engine";
import { buildPlan, horizon, type PlanInput } from "@/lib/actionPlan";
import demo from "@/lib/demo.json";

const workers: Worker[] = demo.rows.map(r => ({ id: r.id, gender: r.gender as "F" | "M", category: r.category, funzione: r.funzione, fte: r.fte, hoursPaid: r.hoursPaid, basePay: r.basePay, variablePay: r.variablePay }));
const base: PlanInput = { today: "2026-09-25", headcount: 180, gap: payGapReport(workers), risk: { persone: 180, valutate: 180, rischio_alto: 20, critiche: 7, costo_a_rischio: 1_500_000 },
  riskGroups: [{ grp: "LOGISTICA", persone: 40, visibile: true, rischio_medio: 58, rischio_alto: 8 }], belowMarket: [{ funzione: "IT", dev: -18, persone: 6 }], marketMissing: false, hasFinalReport: false };

describe("piano d'azione", () => {
  const plan = buildPlan(base);
  it("ordinato per priorità e poi per scadenza", () => {
    const order = { Critica: 0, Alta: 1, Media: 2, Bassa: 3 };
    for (let i = 1; i < plan.length; i++) expect(order[plan[i - 1]!.priority] <= order[plan[i]!.priority]).toBe(true);
  });
  it("una azione per ogni categoria oltre il 5%, critica perché c'è l'obbligo di comunicazione", () => {
    const over = base.gap!.categories.filter(c => c.overThreshold);
    const acts = plan.filter(a => a.key.startsWith("gap:") && !["gap:campioni", "gap:q4", "gap:variabile"].includes(a.key));
    expect(acts).toHaveLength(over.length);
    expect(acts.every(a => a.priority === "Critica" && a.rif === "D.Lgs. 96/2026, art. 10")).toBe(true);
  });
  it("comunicazione: 150–249 dipendenti → scadenza 7/6/2027, priorità Alta a più di 6 mesi", () => {
    const c = plan.find(a => a.key === "comunicazione:2027-06-07")!;
    expect(c.priority).toBe("Alta");
    expect(c.due).toBe("2027-03-07"); // 3 mesi di margine prima della scadenza di legge
  });
  it("sotto i 100 dipendenti nessuna comunicazione obbligatoria ma restano gli obblighi di trasparenza", () => {
    const p = buildPlan({ ...base, headcount: 40 });
    expect(p.some(a => a.key.startsWith("comunicazione:"))).toBe(false);
    expect(p.map(a => a.key)).toEqual(expect.arrayContaining(["trasp:annunci", "trasp:informativa-annuale", "privacy:dpia"]));
    expect(p.find(a => a.key === "trasp:criteri")!.why).toMatch(/Sotto i 50/);
  });
  it("rischio: priorità critiche, funzioni calde e mercato", () => {
    expect(plan.find(a => a.key === "rischio:critiche")).toMatchObject({ priority: "Critica", title: "Colloqui con le 7 persone a priorità critica" });
    expect(plan.find(a => a.key === "rischio:funzioni")!.title).toContain("LOGISTICA");
    expect(plan.find(a => a.key === "mercato:IT")!.priority).toBe("Alta");
  });
  it("senza dati: la prima cosa è caricarli", () => {
    const p = buildPlan({ ...base, gap: null, risk: null, riskGroups: [], belowMarket: [] });
    expect(p[0]!.key === "dati:carica" || p.some(a => a.key === "dati:carica")).toBe(true);
    expect(p.some(a => a.key === "report:definitivo")).toBe(false);
  });
  it("chiavi stabili e uniche (servono a ricordare lo stato)", () => {
    expect(new Set(plan.map(a => a.key)).size).toBe(plan.length);
  });
  it("orizzonti temporali", () => {
    expect(horizon("2026-09-25", "2026-10-20")).toBe("Subito (entro 30 giorni)");
    expect(horizon("2026-09-25", "2026-12-24")).toBe("Entro 3 mesi");
    expect(horizon("2026-09-25", "2027-03-07")).toBe("Entro 6 mesi");
    expect(horizon("2026-09-25", "2028-01-01")).toBe("Oltre 12 mesi");
  });
});
