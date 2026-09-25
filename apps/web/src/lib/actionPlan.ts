import type { PayGapReport } from "@g1g10/engine";
import { reportingObligation } from "@g1g10/engine";

/**
 * Piano d'azione: regole che trasformano i dati di un periodo in azioni con priorità e scadenza.
 * Priorità = esposizione legale (obbligo con scadenza, D.Lgs. 96/2026) + impatto (persone, costo, entità del divario).
 *   Critica: obbligo di legge a rischio o danno imminente · Alta: da avviare entro 3 mesi · Media: entro 6–12 mesi · Bassa: miglioramento.
 */
export type Priority = "Critica" | "Alta" | "Media" | "Bassa";
export type Area = "Equità retributiva" | "Trasparenza" | "Rischio di uscita" | "Mercato" | "Dati e privacy";

export interface Action {
  key: string; area: Area; priority: Priority; title: string; why: string; steps: string[];
  rif?: string; owner: string; due: string;
}

export interface RiskAgg { persone: number; valutate: number; rischio_alto: number; critiche: number; costo_a_rischio: number }
export interface RiskGroupAgg { grp: string; persone: number; visibile: boolean; rischio_medio: number | null; rischio_alto: number | null }

export interface PlanInput {
  today: string;
  headcount: number;
  gap: PayGapReport | null;
  risk: RiskAgg | null;
  riskGroups: RiskGroupAgg[];
  /** Funzioni con retribuzione di base sotto il mercato (scostamento % negativo). */
  belowMarket: { funzione: string; dev: number; persone: number }[];
  marketMissing: boolean;
  hasFinalReport: boolean;
}

export const PRIORITY_ORDER: Record<Priority, number> = { Critica: 0, Alta: 1, Media: 2, Bassa: 3 };

const addDays = (d: string, n: number) => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const addMonths = (d: string, n: number) => { const x = new Date(d + "T00:00:00Z"); x.setUTCMonth(x.getUTCMonth() + n); return x.toISOString().slice(0, 10); };
const monthsBetween = (a: string, b: string) => (+new Date(b) - +new Date(a)) / (30.44 * 864e5);
const pct = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1).replace(".", ",")}%`;
const eur = (v: number) => `€ ${Math.round(v).toLocaleString("it-IT")}`;

/** Orizzonte temporale di un'azione rispetto a oggi. */
export function horizon(today: string, due: string): "Subito (entro 30 giorni)" | "Entro 3 mesi" | "Entro 6 mesi" | "Entro 12 mesi" | "Oltre 12 mesi" {
  const m = monthsBetween(today, due);
  return m <= 1.05 ? "Subito (entro 30 giorni)" : m <= 3.05 ? "Entro 3 mesi" : m <= 6.05 ? "Entro 6 mesi" : m <= 12.05 ? "Entro 12 mesi" : "Oltre 12 mesi";
}
export const HORIZONS = ["Subito (entro 30 giorni)", "Entro 3 mesi", "Entro 6 mesi", "Entro 12 mesi", "Oltre 12 mesi"] as const;

export function buildPlan(i: PlanInput): Action[] {
  const A: Action[] = [];
  const t = i.today, ob = reportingObligation(i.headcount);

  // ---------------------------------------------------------------- Equità retributiva
  if (i.gap) {
    for (const c of i.gap.categories.filter(x => x.overThreshold)) {
      const big = Math.abs(c.gapMean!) >= 10;
      A.push({
        key: `gap:${c.category}`, area: "Equità retributiva", priority: big || ob.required ? "Critica" : "Alta",
        title: `Motivare o correggere il divario del ${pct(c.gapMean!)} in «${c.category}»`,
        why: `${c.n.F} donne e ${c.n.M} uomini: il livello retributivo medio differisce di almeno il 5%. Se il divario non è motivato da criteri oggettivi e neutri e non è corretto entro 6 mesi dalla comunicazione, scatta la valutazione congiunta con i rappresentanti dei lavoratori.`,
        steps: ["Scendere nella categoria in Equità e confrontare le singole posizioni (livello, anzianità, FTE, mansione).",
          "Documentare per iscritto i criteri oggettivi che spiegano le differenze (competenze, responsabilità, condizioni di lavoro).",
          "Per le differenze non motivate: definire gli adeguamenti retributivi e il loro calendario.",
          "Ricalcolare il report dopo gli interventi e salvarlo."],
        rif: "D.Lgs. 96/2026, art. 10", owner: "HR con Direzione", due: addDays(t, big ? 60 : 90),
      });
    }
    const unpublished = i.gap.categories.filter(c => !c.published).length;
    if (unpublished) A.push({
      key: "gap:campioni", area: "Equità retributiva", priority: "Bassa",
      title: `Rendere valutabili ${unpublished} categorie con meno di 3 persone per genere`,
      why: "Per queste categorie il divario non si può calcolare in modo affidabile e anonimo.",
      steps: ["Verificare se più categorie corrispondono a lavori di pari valore secondo il CCNL (art. 4) e possono essere unite.", "In alternativa documentare la valutazione caso per caso."],
      rif: "D.Lgs. 96/2026, art. 4", owner: "HR", due: addMonths(t, 9),
    });
    const q4 = i.gap.quartiles.find(q => q.index === 4), totF = (i.gap.counted.F / Math.max(1, i.gap.counted.F + i.gap.counted.M)) * 100;
    if (q4 && q4.n >= 4 && q4.shareF < totF - 10) A.push({
      key: "gap:q4", area: "Equità retributiva", priority: "Media",
      title: "Ridurre la segregazione verticale: poche donne nelle retribuzioni più alte",
      why: `Nel quartile più alto le donne sono il ${Math.round(q4.shareF)}% contro il ${Math.round(totF)}% sul totale.`,
      steps: ["Analizzare promozioni e passaggi di livello per genere negli ultimi 3 anni.", "Definire obiettivi di crescita e percorsi di sviluppo per le candidate interne.", "Verificare che i criteri di progressione siano scritti e neutri (art. 6)."],
      rif: "D.Lgs. 96/2026, artt. 6 e 9 lett. f", owner: "HR con Direzione", due: addMonths(t, 12),
    });
    const vr = i.gap.variableRecipients, vg = i.gap.gapVariableMean;
    if ((vg !== null && Math.abs(vg) >= 5) || Math.abs(vr.F - vr.M) >= 10) A.push({
      key: "gap:variabile", area: "Equità retributiva", priority: "Alta",
      title: "Rivedere i criteri di premi e componenti variabili",
      why: `Ricevono il variabile il ${Math.round(vr.F)}% delle donne e il ${Math.round(vr.M)}% degli uomini; divario medio del variabile ${vg === null ? "n.d." : pct(vg)}.`,
      steps: ["Elencare premi, bonus e indennità variabili con i criteri di assegnazione.", "Verificare che i criteri siano oggettivi, misurabili e neutri rispetto al genere.", "Correggere i criteri o le assegnazioni che penalizzano un genere."],
      rif: "D.Lgs. 96/2026, art. 9 lett. b, d, e", owner: "HR", due: addMonths(t, 3),
    });
  } else {
    A.push({ key: "dati:carica", area: "Dati e privacy", priority: "Critica", title: "Caricare i dati retributivi del periodo",
      why: "Senza dati non è possibile calcolare il divario né preparare la comunicazione obbligatoria.",
      steps: ["Scaricare il modello Excel dalla scheda «Dati & report Direttiva».", "Compilarlo con i dati del periodo (retribuzione fissa separata dal variabile) e caricarlo."], owner: "HR", due: addDays(t, 30) });
  }

  // ---------------------------------------------------------------- Comunicazione obbligatoria
  if (ob.required && ob.firstDeadline) {
    const months = monthsBetween(t, ob.firstDeadline);
    A.push({
      key: `comunicazione:${ob.firstDeadline}`, area: "Trasparenza", priority: months <= 6 ? "Critica" : months <= 12 ? "Alta" : "Media",
      title: `Preparare la comunicazione del divario retributivo (scadenza ${new Date(ob.firstDeadline).toLocaleDateString("it-IT")})`,
      why: `Con ${i.headcount} dipendenti la comunicazione è ${ob.frequency}. ${ob.note}`,
      steps: ["Verificare che le categorie corrispondano ai livelli del CCNL applicato.", "Condividere metodologia e dati con i rappresentanti dei lavoratori e confermarne l'esattezza (art. 9 c. 2).",
        "Rendere definitivo il report nell'app (resta come prova).", "Trasmettere i dati all'organismo di monitoraggio con le modalità del decreto ministeriale (art. 9 c. 4), quando pubblicato.",
        "Rendere accessibile a lavoratori e rappresentanti l'indicatore per categoria (lett. g)."],
      rif: "D.Lgs. 96/2026, art. 9", owner: "HR con RSU/RSA", due: months > 7 ? addMonths(ob.firstDeadline, -3) : ob.firstDeadline,
    });
  }
  if (i.gap && !i.hasFinalReport) A.push({
    key: "report:definitivo", area: "Trasparenza", priority: ob.required ? "Alta" : "Media",
    title: "Salvare e rendere definitivo il report del periodo",
    why: "Il report definitivo non è più modificabile: serve come prova in caso di verifiche o contenziosi e va conservato per gli anni successivi.",
    steps: ["Nella scheda «Dati & report Direttiva» salvare una copia del report.", "Dopo il controllo con i rappresentanti, renderla definitiva."],
    rif: "D.Lgs. 96/2026, art. 9 c. 6; Codice pari opportunità, art. 40", owner: "HR", due: addMonths(t, 2),
  });

  // ---------------------------------------------------------------- Obblighi di trasparenza (per tutte le aziende)
  A.push({ key: "trasp:annunci", area: "Trasparenza", priority: "Alta", title: "Indicare retribuzione o fascia negli annunci di lavoro",
    why: "Obbligo in vigore dal 7/6/2026 per tutte le aziende; vietato anche chiedere ai candidati la retribuzione passata.",
    steps: ["Definire per ogni posizione aperta la retribuzione iniziale o la fascia, con il riferimento al CCNL.", "Aggiornare modelli di annuncio e istruzioni alle agenzie di selezione.", "Togliere dai colloqui e dai moduli le domande sulla retribuzione attuale o precedente."],
    rif: "D.Lgs. 96/2026, art. 5", owner: "HR / Selezione", due: addDays(t, 30) });
  A.push({ key: "trasp:informativa-annuale", area: "Trasparenza", priority: "Alta", title: "Informare tutti i lavoratori del diritto di informazione",
    why: "Va fatto ogni anno; le richieste vanno evase per iscritto entro 2 mesi.",
    steps: ["Inviare una comunicazione a tutti (email, intranet, bacheca) su come chiedere i livelli retributivi medi per sesso della propria categoria.", "Stabilire chi riceve le richieste e come si rispetta la scadenza di 2 mesi.", "Valutare la pubblicazione dei dati per categoria nell'intranet (art. 7 c. 2)."],
    rif: "D.Lgs. 96/2026, art. 7", owner: "HR", due: addDays(t, 30) });
  A.push({ key: "trasp:criteri", area: "Trasparenza", priority: "Media", title: i.headcount >= 50 ? "Rendere accessibili i criteri retributivi e di progressione" : "Rendere accessibili i criteri retributivi",
    why: i.headcount >= 50 ? "Con almeno 50 dipendenti vanno resi accessibili anche i criteri di progressione economica." : "Sotto i 50 dipendenti non è obbligatorio pubblicare i criteri di progressione.",
    steps: ["Raccogliere in un documento i criteri di inquadramento, retribuzione e progressione (rinvio al CCNL e agli accordi aziendali).", "Metterlo a disposizione di tutti i lavoratori."],
    rif: "D.Lgs. 96/2026, art. 6", owner: "HR", due: addMonths(t, 3) });
  A.push({ key: "trasp:clausole", area: "Trasparenza", priority: "Media", title: "Eliminare le clausole di riservatezza sulla retribuzione",
    why: "Sono vietate le clausole che impediscono ai lavoratori di rendere nota la propria retribuzione.",
    steps: ["Controllare contratti individuali, regolamenti e codici interni.", "Rimuovere o disapplicare le clausole in contrasto."],
    rif: "D.Lgs. 96/2026, art. 7 c. 6", owner: "HR / Legale", due: addMonths(t, 3) });

  // ---------------------------------------------------------------- Rischio di uscita (solo aggregati)
  if (i.risk && i.risk.critiche > 0) A.push({
    key: "rischio:critiche", area: "Rischio di uscita", priority: "Critica",
    title: `Colloqui con le ${i.risk.critiche} persone a priorità critica`,
    why: `Costo a rischio complessivo stimato ${eur(i.risk.costo_a_rischio)}. I nomi sono visibili solo al ruolo HR rischio in Segnali.`,
    steps: ["Aprire in Segnali le priorità critiche e aprire un caso nel Registro per ciascuna.", "Fissare un colloquio con il responsabile diretto e HR.", "Concordare un intervento (crescita, carico, riconoscimento, retribuzione) e monitorarlo."],
    owner: "HR rischio con i responsabili", due: addDays(t, 30),
  });
  const hot = i.riskGroups.filter(g => g.visibile && (g.rischio_medio ?? 0) >= 55).slice(0, 3);
  if (hot.length) A.push({
    key: "rischio:funzioni", area: "Rischio di uscita", priority: "Alta",
    title: `Piano di permanenza per: ${hot.map(g => g.grp).join(", ")}`,
    why: `Rischio medio elevato: ${hot.map(g => `${g.grp} ${Math.round(g.rischio_medio!)}`).join(" · ")}.`,
    steps: ["In Funzioni & rischio individuare i fattori ricorrenti del gruppo.", "Definire interventi collettivi (organizzazione del lavoro, percorsi di crescita, riconoscimento).", "Rivalutare il gruppo dopo 3 mesi."],
    owner: "HR con Direzione", due: addMonths(t, 3),
  });
  if (i.risk && i.risk.valutate < i.risk.persone) A.push({
    key: "rischio:copertura", area: "Rischio di uscita", priority: "Media",
    title: `Completare le valutazioni di rischio (${i.risk.persone - i.risk.valutate} persone non valutate)`,
    why: "Il quadro del rischio considera solo le persone valutate.",
    steps: ["Caricare il foglio «Fattori rischio» o valutare le persone in Valutazione (con motivazione)."],
    owner: "HR rischio", due: addMonths(t, 6),
  });

  // ---------------------------------------------------------------- Mercato
  for (const m of i.belowMarket.filter(x => x.dev <= -7)) A.push({
    key: `mercato:${m.funzione}`, area: "Mercato", priority: m.dev <= -15 ? "Alta" : "Media",
    title: `Allineare al mercato le retribuzioni di «${m.funzione}» (${pct(m.dev)})`,
    why: `${m.persone} persone con retribuzione di base sotto il riferimento di mercato: aumenta il rischio di uscita e la difficoltà di assumere.`,
    steps: ["Verificare il riferimento di mercato scelto nella scheda Mercato.", "Stimare il costo dell'allineamento e confrontarlo con il costo a rischio.", "Programmare gli adeguamenti nel budget."],
    owner: "HR con Direzione", due: addMonths(t, m.dev <= -15 ? 3 : 6),
  });
  if (i.marketMissing) A.push({ key: "mercato:riferimenti", area: "Mercato", priority: "Bassa", title: "Impostare i riferimenti di mercato per funzione",
    why: "Senza riferimenti il confronto con il mercato e il relativo fattore di rischio non si possono calcolare.",
    steps: ["Nella scheda Mercato scegliere per ogni funzione un riferimento ufficiale o inserire una RAL di mercato."], owner: "HR", due: addMonths(t, 3) });

  // ---------------------------------------------------------------- Dati e privacy
  A.push({ key: "privacy:dpia", area: "Dati e privacy", priority: "Critica", title: "Valutazione d'impatto privacy (DPIA) sul rischio di uscita",
    why: "Il punteggio di rischio è una profilazione dei lavoratori: va valutato prima dell'uso con dati reali.",
    steps: ["Condividere con il DPO la descrizione del modello, dei fattori e delle misure di sicurezza dell'app.", "Valutare con il DPO il fattore «Comportamento» (Statuto dei Lavoratori, artt. 4 e 8).", "Documentare l'esito della DPIA."],
    rif: "GDPR art. 35; L. 300/1970 artt. 4 e 8", owner: "DPO con HR", due: addDays(t, 30) });
  A.push({ key: "privacy:informativa", area: "Dati e privacy", priority: "Critica", title: "Informativa ai lavoratori sui dati retributivi e sul rischio di uscita",
    why: "I lavoratori vanno informati del trattamento dei loro dati e dei sistemi di valutazione utilizzati.",
    steps: ["Preparare con il DPO l'informativa (finalità, dati, chi accede, conservazione, diritti).", "Consegnarla a tutti i lavoratori e ai nuovi assunti."],
    rif: "GDPR artt. 13–14; D.Lgs. 104/2022", owner: "DPO con HR", due: addDays(t, 30) });
  if (i.headcount > 50) A.push({ key: "legge:rapporto-biennale", area: "Trasparenza", priority: "Media", title: "Rapporto biennale sulla situazione del personale",
    why: "Obbligatorio per le aziende con più di 50 dipendenti.", steps: ["Verificare la prossima scadenza del biennio sul portale ministeriale.", "Riutilizzare i dati per genere già presenti nell'app."],
    rif: "D.Lgs. 198/2006, art. 46", owner: "HR", due: addMonths(t, 6) });
  if (i.headcount >= 50) A.push({ key: "legge:certificazione", area: "Trasparenza", priority: "Bassa", title: "Valutare la certificazione della parità di genere",
    why: "Volontaria: dà diritto a sgravio contributivo fino all'1% (massimo 50.000 € l'anno) e a premialità nei bandi.",
    steps: ["Generare il Dossier parità di genere dai Documenti.", "Valutare con un organismo accreditato le aree mancanti (cultura, genitorialità)."],
    rif: "UNI/PdR 125:2022; L. 162/2021", owner: "Direzione con HR", due: addMonths(t, 12) });

  return A.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.due.localeCompare(b.due));
}
