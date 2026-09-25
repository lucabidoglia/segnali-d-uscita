import { describe, expect, it } from "vitest";
import { JOINT_ASSESSMENT_THRESHOLD, reportingObligation } from "@g1g10/engine";
import { PARAMETRI, SEZIONI } from "@/lib/normativa";
import watch from "@/lib/normativa-watch.json";

// Se cambia la norma e si aggiorna la pagina, questi test obbligano ad aggiornare anche il motore (e viceversa).
describe("normativa e motore restano allineati", () => {
  const val = (rif: string) => PARAMETRI.filter(p => p.rif.startsWith(rif)).map(p => `${p.cosa}: ${p.valore}`).join(" | ");
  it("soglia della valutazione congiunta", () => {
    expect(JOINT_ASSESSMENT_THRESHOLD).toBe(5);
    expect(val("art. 10, c. 1 lett. a")).toContain("≥ 5%");
  });
  it("obbligo e scadenze per dimensione", () => {
    expect(val("art. 9, c. 8")).toContain("100");
    expect(reportingObligation(99).required).toBe(false);
    expect(val("art. 9, c. 9")).toContain("Da 250 dipendenti: entro il 7/6/2027, poi ogni anno");
    expect(reportingObligation(250)).toMatchObject({ frequency: "annuale", firstDeadline: "2027-06-07" });
    expect(reportingObligation(150)).toMatchObject({ frequency: "triennale", firstDeadline: "2027-06-07" });
    expect(reportingObligation(100)).toMatchObject({ frequency: "triennale", firstDeadline: "2031-06-07" });
  });
  it("il livello retributivo è quello dell'art. 3 lett. b", () => {
    expect(SEZIONI.find(s => s.rif === "art. 3")!.punti.join(" ")).toMatch(/soli elementi fissi e continuativi/);
  });
  it("tutte le fonti sorvegliate hanno una versione verificata", () => {
    for (const s of watch.sources) expect(s.fingerprint, s.id).toBeTruthy();
  });
});
