/**
 * Modello dati canonico di un lavoratore nel periodo di riferimento.
 * È il "formato unico" in cui confluiscono l'import Excel e i connettori
 * dei gestionali paghe (Zucchetti e successivi): il motore lavora solo su questo.
 */
export type Gender = 'F' | 'M' | 'ND'; // ND = non dichiarato / altro: contato nell'organico, escluso dal calcolo del divario

export interface Worker {
  /** Matricola: univoca all'interno dell'azienda. */
  id: string;
  gender: Gender;
  /**
   * Categoria di lavoratori che svolgono lo stesso lavoro o un lavoro di pari valore
   * (Dir. UE 2023/970, art. 4). Deve derivare da un sistema di valutazione delle
   * posizioni con criteri neutri; in mancanza si usa la funzione.
   */
  category: string;
  funzione: string;
  mansione?: string;
  sede?: string;
  area?: string;
  livello?: string;
  /** Impegno contrattuale: 1 = tempo pieno. */
  fte: number;
  /** Ore retribuite nel periodo (ordinarie + straordinarie). */
  hoursPaid: number;
  /** Retribuzione lorda di base (ordinaria) nel periodo, in euro. */
  basePay: number;
  /** Componenti complementari o variabili (premi, indennità, bonus, fringe) nel periodo, in euro. */
  variablePay: number;
  /** Costo aziendale nel periodo (retribuzione + oneri). Facoltativo: serve alle schede di rendicontazione, non al divario. */
  employerCost?: number;
  seniorityYears?: number;
}
