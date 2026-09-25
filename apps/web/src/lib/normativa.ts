/**
 * Sintesi della normativa sull'equità retributiva mostrata in /normativa.
 * Fonte principale: D.Lgs. 7 maggio 2026, n. 96 (testo in GU n. 125 del 1/6/2026, letto integralmente).
 *
 * Si aggiorna SOLO quando cambia la norma: scripts/check-normativa.mjs confronta ogni settimana le fonti ufficiali
 * e, se cambiano, segna la pagina "in verifica" (normativa-watch.json). Dopo aver rivisto il testo qui sotto:
 * aggiornare VERIFIED_ON e lanciare `node scripts/check-normativa.mjs --accept`.
 */

export const VERIFIED_ON = "2026-09-25";

export const NORMA = {
  titolo: "D.Lgs. 7 maggio 2026, n. 96",
  descrizione: "Attuazione della direttiva (UE) 2023/970 sulla parità di retribuzione tra uomini e donne per uno stesso lavoro o per un lavoro di pari valore, attraverso la trasparenza retributiva",
  gazzetta: "Gazzetta Ufficiale, Serie Generale n. 125 del 1° giugno 2026",
  vigore: "2026-06-07",
};

export const FONTI = [
  { nome: "D.Lgs. 96/2026 — testo vigente (Normattiva)", url: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2026-05-07;96" },
  { nome: "D.Lgs. 96/2026 — Gazzetta Ufficiale n. 125 del 1/6/2026", url: "https://www.gazzettaufficiale.it/atto/serie_generale/caricaDettaglioAtto/originario?atto.dataPubblicazioneGazzetta=2026-06-01&atto.codiceRedazionale=26G00112" },
  { nome: "Direttiva (UE) 2023/970 (EUR-Lex)", url: "https://eur-lex.europa.eu/eli/dir/2023/970/oj" },
  { nome: "Codice delle pari opportunità, D.Lgs. 198/2006 (Normattiva)", url: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2006-04-11;198" },
];

export const SINTESI = [
  "Donne e uomini devono ricevere la stessa retribuzione per lo stesso lavoro o per un lavoro di pari valore.",
  "Il decreto rende le retribuzioni trasparenti: prima dell'assunzione, durante il rapporto e verso l'esterno.",
  "Le aziende con almeno 100 dipendenti comunicano periodicamente il proprio divario retributivo di genere.",
  "Se in una categoria il divario è di almeno il 5%, non è giustificato e non viene corretto entro 6 mesi, scatta la valutazione congiunta con i sindacati.",
];

/** Parametri numerici da rispettare. `app` = dove l'app li applica. */
export const PARAMETRI: { cosa: string; valore: string; rif: string; app?: string }[] = [
  { cosa: "Soglia di divario in una categoria che fa scattare la valutazione congiunta", valore: "≥ 5%", rif: "art. 10, c. 1 lett. a", app: "Report Direttiva ed Equità (in rosso)" },
  { cosa: "Tempo per correggere un divario non motivato", valore: "6 mesi dalla comunicazione", rif: "art. 10, c. 1 lett. c" },
  { cosa: "Obbligo di comunicare il divario", valore: "da 100 dipendenti", rif: "art. 9, c. 8", app: "Report: «Obbligo di comunicazione»" },
  { cosa: "Da 250 dipendenti", valore: "entro il 7/6/2027, poi ogni anno", rif: "art. 9, c. 9" },
  { cosa: "Da 150 a 249 dipendenti", valore: "entro il 7/6/2027, poi ogni 3 anni", rif: "art. 9, c. 9" },
  { cosa: "Da 100 a 149 dipendenti", valore: "entro il 7/6/2031, poi ogni 3 anni", rif: "art. 9, c. 9" },
  { cosa: "Risposta alla richiesta di informazioni del lavoratore", valore: "per iscritto entro 2 mesi, al massimo 1 richiesta l'anno", rif: "art. 7, c. 1" },
  { cosa: "Informare tutti i lavoratori del diritto di informazione", valore: "ogni anno", rif: "art. 7, c. 4" },
  { cosa: "Risposta motivata a chiarimenti sui dati comunicati", valore: "entro 60 giorni", rif: "art. 9, c. 7" },
  { cosa: "Dati degli anni precedenti da fornire su richiesta", valore: "4 anni, se disponibili", rif: "art. 9, c. 6", app: "Report definitivi immutabili e conservati" },
  { cosa: "Criteri di progressione economica da rendere accessibili", valore: "da 50 dipendenti", rif: "art. 6, c. 3" },
  { cosa: "Modalità speciali per le informazioni (tutela della riservatezza)", valore: "fino a 49 dipendenti", rif: "art. 7, c. 8" },
  { cosa: "Sanzione per le discriminazioni (art. 41 Codice pari opportunità)", valore: "ammenda da 250 a 1.500 €; revoca di benefici ed esclusione fino a 2 anni da agevolazioni e appalti", rif: "art. 13; D.Lgs. 198/2006 art. 41" },
];

export interface Sezione { titolo: string; rif: string; punti: string[]; app?: string }

export const SEZIONI: Sezione[] = [
  { titolo: "A chi si applica", rif: "art. 2", punti: [
    "Datori di lavoro pubblici e privati.",
    "Contratti di lavoro subordinato a tempo determinato e indeterminato, anche part-time, dirigenti compresi.",
    "Esclusi: lavoro domestico e lavoro intermittente.",
    "Le regole sulla fase di selezione valgono anche per i candidati.",
  ] },
  { titolo: "Le parole chiave", rif: "art. 3", punti: [
    "Retribuzione: stipendio di base più tutte le somme e i valori versati, anche in natura, comprese le componenti complementari o variabili.",
    "Livello retributivo: retribuzione lorda annua e oraria dei soli elementi fissi e continuativi, esclusi i trattamenti individuali personali, discrezionali o temporanei. È la base del divario.",
    "Divario retributivo di genere: (livello medio uomini − livello medio donne) ÷ livello medio uomini, in percentuale. Anche nella versione mediana.",
    "Quartile retributivo: ciascuno dei quattro gruppi uguali in cui si dividono i lavoratori dal livello più basso al più alto.",
    "Categoria di lavoratori: chi svolge lo stesso lavoro o un lavoro di pari valore.",
    "L'azienda non deve raccogliere dati diversi dal sesso per queste finalità.",
  ], app: "Il motore usa il livello retributivo (campo «Retribuzione base lorda», solo elementi fissi) e misura il variabile a parte." },
  { titolo: "Stesso lavoro e lavoro di pari valore", rif: "art. 4", punti: [
    "Stesso lavoro: mansioni identiche o della stessa qualifica, nello stesso livello e categoria legale del CCNL applicato.",
    "Lavoro di pari valore: mansioni diverse ma comparabili, secondo i livelli di inquadramento del CCNL.",
    "Criteri comuni, oggettivi e neutri: competenze, responsabilità, condizioni di lavoro e altri fattori pertinenti.",
    "Applicare un CCNL firmato dai sindacati comparativamente più rappresentativi è presunzione di conformità, salvo trattamenti individuali discriminatori.",
    "Sono ammessi sistemi aziendali di valutazione aggiuntivi, se oggettivi e neutri.",
    "Il Ministro del lavoro può adottare atti di indirizzo entro il 31/12/2026.",
  ], app: "Nel file Excel la «Categoria pari valore» corrisponde di norma al livello CCNL." },
  { titolo: "Prima dell'assunzione", rif: "art. 5", punti: [
    "Negli annunci va indicata la retribuzione iniziale o la fascia, con le disposizioni del CCNL applicabili.",
    "Vietato chiedere ai candidati quanto guadagnavano, anche tramite agenzie di selezione.",
    "Annunci e selezioni neutri rispetto al genere.",
  ], app: "Non ancora gestito dall'app (prossimo passo: fasce retributive per annunci)." },
  { titolo: "Trasparenza dei criteri", rif: "art. 6", punti: [
    "L'azienda rende accessibili i criteri per fissare le retribuzioni e per la progressione economica.",
    "Chi applica un CCNL comparativamente più rappresentativo può rinviare ai criteri del contratto e agli accordi aziendali.",
    "Sotto i 50 dipendenti non è obbligatorio pubblicare i criteri di progressione.",
  ] },
  { titolo: "Diritto di informazione dei lavoratori", rif: "art. 7", punti: [
    "Ogni lavoratore può chiedere per iscritto i livelli retributivi medi, per sesso, della propria categoria; risposta entro 2 mesi, al massimo una volta l'anno.",
    "L'azienda può rispondere pubblicando questi dati nell'intranet.",
    "Ogni anno l'azienda informa tutti del diritto e di come esercitarlo.",
    "Vietate le clausole che impediscono di dire quanto si guadagna.",
    "Le informazioni non devono permettere di risalire alla retribuzione di singoli colleghi.",
  ], app: "I dati per categoria sono in Equità; il registro delle richieste con scadenza a 2 mesi è un prossimo passo." },
  { titolo: "Comunicazione del divario", rif: "art. 9", punti: [
    "Da 100 dipendenti si comunicano 7 indicatori: a) divario medio, b) divario medio del variabile, c) divario mediano, d) divario mediano del variabile, e) quota di donne e uomini con variabile, f) quota di donne e uomini per quartile, g) divario per categoria, separato tra base e variabile.",
    "L'esattezza dei dati è confermata dall'azienda dopo aver consultato i rappresentanti dei lavoratori.",
    "I dati vanno all'organismo di monitoraggio presso il Ministero del lavoro, che pubblica gli indicatori a–f; l'indicatore g va reso accessibile a lavoratori e rappresentanti.",
    "I gruppi con una politica salariale unitaria possono aggregare i dati a livello nazionale.",
  ], app: "Report Direttiva: tutti e 7 gli indicatori, obbligo e scadenze per dimensione." },
  { titolo: "Valutazione congiunta delle retribuzioni", rif: "art. 10", punti: [
    "Si fa con i rappresentanti dei lavoratori quando ci sono insieme tre condizioni: divario di almeno il 5% in una categoria, non motivato da criteri oggettivi e neutri, non corretto entro 6 mesi.",
    "Contiene: quote di donne e uomini per categoria, livelli medi e variabili, differenze e loro ragioni, miglioramenti retributivi al rientro dai congedi, misure correttive, efficacia delle misure precedenti.",
    "Gli esiti vanno ai lavoratori, all'organismo di monitoraggio e, su richiesta, a Ispettorato e consigliere di parità.",
  ], app: "L'app segnala le categorie oltre il 5%; il percorso guidato della valutazione congiunta è un prossimo passo." },
  { titolo: "Dati personali", rif: "art. 11", punti: [
    "Trattamento conforme al GDPR; i dati servono solo alla parità retributiva.",
    "Se si rischia di rivelare la retribuzione di una persona identificabile, l'accesso è riservato a rappresentanti, Ispettorato e consigliere di parità.",
  ], app: "Gruppi piccoli oscurati, ruoli separati, accessi registrati." },
  { titolo: "Tutele e sanzioni", rif: "artt. 12–13", punti: [
    "Si applicano le tutele del Codice delle pari opportunità (D.Lgs. 198/2006, libro III, titolo I, capo III), comprese le regole sull'onere della prova.",
    "Possono agire, su delega, anche i rappresentanti dei lavoratori, i sindacati e le associazioni per la parità.",
    "Protezione contro le ritorsioni per chi esercita i diritti (art. 41-bis del Codice).",
    "Sanzioni: art. 41 del Codice (ammenda da 250 a 1.500 €; revoca dei benefici ed esclusione fino a 2 anni da agevolazioni e appalti).",
  ] },
  { titolo: "Monitoraggio e statistiche", rif: "artt. 14–15", punti: [
    "Organismo di monitoraggio presso il Ministero del lavoro: raccoglie e pubblica i dati, riceve le valutazioni congiunte.",
    "Relazione alla Commissione europea entro il 7/6/2028 e poi ogni due anni.",
    "Dal 31/1/2028 (anno 2026) i dati nazionali vanno ogni anno a Eurostat.",
  ] },
];

/** Atti attuativi previsti dal decreto: stato da ricontrollare a ogni verifica. */
export const IN_ATTESA: { cosa: string; entro: string; rif: string; stato: string }[] = [
  { cosa: "Decreto del Ministro del lavoro sulle modalità di raccolta e comunicazione dei dati (anche per le aziende fino a 49 dipendenti)", entro: "90 giorni dal 7/6/2026", rif: "art. 9, c. 4", stato: "Non risulta ancora pubblicato alla data di verifica" },
  { cosa: "Decreto su composizione e funzionamento dell'organismo di monitoraggio", entro: "180 giorni dal 7/6/2026", rif: "art. 14, c. 5", stato: "Atteso" },
  { cosa: "Atti di indirizzo sullo stesso lavoro e sul lavoro di pari valore", entro: "31/12/2026 (facoltativi)", rif: "art. 4, c. 6", stato: "Atteso" },
];

export const COLLEGATE: { nome: string; cosa: string }[] = [
  { nome: "Codice delle pari opportunità (D.Lgs. 198/2006)", cosa: "Divieto di discriminazione retributiva (art. 28), onere della prova (art. 40), sanzioni (art. 41), rapporto biennale sul personale per le aziende con più di 50 dipendenti (art. 46)." },
  { nome: "Certificazione della parità di genere UNI/PdR 125:2022 (L. 162/2021)", cosa: "Volontaria; con almeno il 60% del punteggio dà accesso a sgravio contributivo fino all'1% (massimo 50.000 € l'anno) e a premialità nei bandi." },
  { nome: "Decreto Trasparenza (D.Lgs. 104/2022)", cosa: "Informativa al lavoratore all'assunzione: per il D.Lgs. 96/2026 (art. 6) è il modo ordinario di comunicare inquadramento, retribuzione e CCNL." },
  { nome: "GDPR (Regolamento UE 2016/679)", cosa: "Tutti i dati retributivi individuali sono dati personali da proteggere." },
];
