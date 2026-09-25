/**
 * Controlli di qualità sui dati importati (Excel o gestionale) prima di qualsiasi calcolo.
 * Gli errori bloccano il report; gli avvisi vanno mostrati all'utente ma non bloccano.
 */
import type { Worker } from './types.js';

export interface Issue {
  severity: 'errore' | 'avviso';
  id: string | null;
  field: keyof Worker | null;
  message: string;
}

export function validateWorkers(ws: readonly Worker[]): Issue[] {
  const out: Issue[] = [];
  const seen = new Set<string>();
  const err = (id: string | null, field: keyof Worker | null, message: string) => out.push({ severity: 'errore', id, field, message });
  const warn = (id: string | null, field: keyof Worker | null, message: string) => out.push({ severity: 'avviso', id, field, message });

  for (const w of ws) {
    if (!w.id) { err(null, 'id', 'Matricola mancante.'); continue; }
    if (seen.has(w.id)) err(w.id, 'id', 'Matricola duplicata.');
    seen.add(w.id);
    if (!['F', 'M', 'ND'].includes(w.gender)) err(w.id, 'gender', 'Genere non valido: usare F, M o ND.');
    if (!w.category) err(w.id, 'category', 'Categoria di lavoratori mancante.');
    if (!(w.fte > 0 && w.fte <= 1)) err(w.id, 'fte', 'FTE deve essere compreso tra 0 (escluso) e 1.');
    if (!(w.hoursPaid > 0)) err(w.id, 'hoursPaid', 'Ore retribuite mancanti o pari a zero: la persona è esclusa dal calcolo del divario.');
    if (!(w.basePay >= 0)) err(w.id, 'basePay', 'Retribuzione di base mancante o negativa.');
    if (!(w.variablePay >= 0)) err(w.id, 'variablePay', 'Componenti variabili negative.');
    if (w.hoursPaid > 0 && w.basePay > 0) {
      const h = w.basePay / w.hoursPaid;
      if (h < 5 || h > 300) warn(w.id, 'basePay', `Retribuzione oraria di base anomala (${h.toFixed(2)} €/h): verificare ore e importi.`);
    }
  }
  const nd = ws.filter(w => w.gender === 'ND').length;
  if (nd) warn(null, 'gender', `${nd} persone con genere non dichiarato: contate nell'organico, escluse dal divario.`);
  return out;
}
