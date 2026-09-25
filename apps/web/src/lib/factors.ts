import type { RiskFactors } from "@g1g10/engine";

/** Fattori di rischio: etichette e punti, identici al prototipo. Usati da Excel e dalla schermata Valutazione. */
export const FACTORS: { key: keyof RiskFactors; head: string; opts: [number, string][] }[] = [
  { key: "sat", head: "Soddisfazione (1–5)", opts: [[1, "1"], [2, "2"], [3, "3"], [4, "4"], [5, "5"]] },
  { key: "load", head: "Carico di lavoro (1–5)", opts: [[1, "1"], [2, "2"], [3, "3"], [4, "4"], [5, "5"]] },
  { key: "promo", head: "Crescita", opts: [[0, "No"], [8, "Ferma"], [16, "Bloccata"]] },
  { key: "extra", head: "Straordinari", opts: [[0, "Normali"], [6, "Elevati"], [12, "Molto elevati"]] },
  { key: "recog", head: "Riconoscimento", opts: [[0, "Adeguato"], [8, "Scarso"], [16, "Assente"]] },
  { key: "behav", head: "Comportamento", opts: [[0, "Nessuno"], [10, "Disimpegno"], [20, "Ritiro"]] },
  { key: "mobil", head: "Mobilità interna", opts: [[0, "Non richiesta"], [6, "Richiesta"], [12, "Bloccata"]] },
  { key: "market", head: "Mercato esterno", opts: [[0, "Debole"], [4, "Normale"], [8, "Molto attivo"]] },
  { key: "perf", head: "Prestazione", opts: [[0, "Standard"], [1, "Alta"], [2, "Eccellente"]] },
  { key: "crit", head: "Competenze critiche", opts: [[0, "Sostituibile"], [1, "Importante"], [2, "Critica"]] },
];
export const COMP_OPTS: [number, string][] = [[0, "In linea"], [5, "Sotto"], [12, "Molto sotto"], [18, "Critico"]];

export const DEFAULT_FACTORS: RiskFactors = { sat: 3, load: 3, promo: 0, extra: 0, recog: 0, comp: 0, behav: 0, market: 0, mobil: 0, perf: 1, crit: 1 };

/** Mercato orario = RAL media di mercato ÷ 1.730 ore (stessa base del prototipo). */
export const MARKET_HOURS = 1730;
/** Costo di sostituzione = RAL × 1,75 (prototipo). */
export const REPLACEMENT_MULT = 1.75;
