/**
 * Indicatori della Direttiva (UE) 2023/970, recepita in Italia dal D.Lgs. 7 maggio 2026, n. 96 (art. 9, c. 1, lett. a–g).
 *
 * Metodo:
 * - «livello retributivo» (D.Lgs. 96/2026, art. 3, lett. b) = retribuzione lorda ORARIA dei soli elementi FISSI E CONTINUATIVI
 *   (campo `basePay` ÷ ore retribuite), esclusi i trattamenti individuali non strutturali. Su questo si calcolano il divario
 *   medio e mediano, i quartili e la soglia del 5% per la valutazione congiunta (art. 10);
 * - le componenti complementari o variabili (`variablePay`) hanno indicatori propri (lett. b, d, e), calcolati sul variabile
 *   orario tra chi lo percepisce; la retribuzione complessiva (base + variabile) è riportata solo a titolo informativo;
 * - le celle con meno di `minCell` persone per genere non vengono pubblicate (anonimato, art. 7 c. 8 e art. 11).
 */
import type { Worker } from './types.ts';
import { gapPct, mean, median } from './stats.ts';

export const JOINT_ASSESSMENT_THRESHOLD = 5; // art. 10: differenza ≥ 5% in una categoria

export interface PayGapOptions {
  /** Minimo di persone per genere per pubblicare un dato. Default 3. */
  minCell?: number;
}

export interface GenderSplit<T> { F: T; M: T }

export interface CategoryGap {
  category: string;
  n: GenderSplit<number>;
  /** false se una delle due popolazioni è sotto `minCell`: i valori sono null. */
  published: boolean;
  meanHourly: GenderSplit<number> | null;
  gapMean: number | null;
  gapMedian: number | null;
  /** Divario scomposto (art. 9, lett. g): salario normale di base e componenti variabili. */
  gapBaseMean: number | null;
  gapVariableMean: number | null;
  /** Solo informativo: divario sulla retribuzione complessiva (base + variabile). */
  gapTotalMean: number | null;
  /** Candidata alla valutazione congiunta (art. 10) se |divario medio del livello retributivo| ≥ 5%. */
  overThreshold: boolean;
}

export interface Quartile {
  index: 1 | 2 | 3 | 4;
  n: number;
  shareF: number;
  shareM: number;
  minHourly: number;
  maxHourly: number;
}

export interface PayGapReport {
  headcount: number;
  counted: GenderSplit<number>;
  excluded: { notDeclared: number; noHours: number };
  /** Norma e metodo applicati (salvati con il report). */
  method: string;
  /** a) divario retributivo medio (livello retributivo: elementi fissi e continuativi) */
  gapMean: number | null;
  /** Solo informativo: divario medio sulla retribuzione complessiva (base + variabile). */
  gapTotalMean: number | null;
  /** c) divario retributivo mediano */
  gapMedian: number | null;
  /** b) divario medio delle componenti variabili (tra chi le percepisce) */
  gapVariableMean: number | null;
  /** d) divario mediano delle componenti variabili */
  gapVariableMedian: number | null;
  /** e) quota di donne e di uomini che percepiscono componenti variabili (%) */
  variableRecipients: GenderSplit<number>;
  /** f) quota di donne e uomini per quartile retributivo (%) */
  quartiles: Quartile[];
  /** g) divario per categoria di lavoratori */
  categories: CategoryGap[];
  jointAssessmentCandidates: string[];
}

export const METHOD = 'D.Lgs. 96/2026 art. 3 lett. b: livello retributivo = elementi fissi e continuativi, orario';
/** Livello retributivo orario (D.Lgs. 96/2026, art. 3, lett. b). */
export const hourlyLevel = (w: Worker): number => w.basePay / w.hoursPaid;
/** Retribuzione oraria complessiva (base + variabile), solo informativa. */
export const hourlyTotal = (w: Worker): number => (w.basePay + w.variablePay) / w.hoursPaid;
const hourlyVar = (w: Worker): number => w.variablePay / w.hoursPaid;

const bySex = (ws: readonly Worker[]): GenderSplit<Worker[]> => ({
  F: ws.filter(w => w.gender === 'F'),
  M: ws.filter(w => w.gender === 'M')
});

const gapOf = (g: GenderSplit<Worker[]>, f: (w: Worker) => number, agg: (a: number[]) => number) =>
  g.F.length && g.M.length ? gapPct(agg(g.F.map(f)), agg(g.M.map(f))) : null;

const share = (part: number, tot: number) => (tot ? (part / tot) * 100 : 0);

export function payGapReport(workers: readonly Worker[], opts: PayGapOptions = {}): PayGapReport {
  const minCell = opts.minCell ?? 3;
  const valid = workers.filter(w => w.hoursPaid > 0);
  const inScope = valid.filter(w => w.gender !== 'ND');
  const g = bySex(inScope);

  const recipients = bySex(inScope.filter(w => w.variablePay > 0));

  const sorted = [...inScope].sort((a, b) => hourlyLevel(a) - hourlyLevel(b));
  const quartiles: Quartile[] = ([1, 2, 3, 4] as const).map(q => {
    const grp = sorted.filter((_, i) => Math.floor((i * 4) / sorted.length) === q - 1);
    const f = grp.filter(w => w.gender === 'F').length;
    return {
      index: q, n: grp.length, shareF: share(f, grp.length), shareM: share(grp.length - f, grp.length),
      minHourly: grp.length ? hourlyLevel(grp[0]!) : NaN, maxHourly: grp.length ? hourlyLevel(grp.at(-1)!) : NaN
    };
  });

  const categories: CategoryGap[] = [...new Set(inScope.map(w => w.category))].sort().map(category => {
    const cg = bySex(inScope.filter(w => w.category === category));
    const published = cg.F.length >= minCell && cg.M.length >= minCell;
    const gapMean = published ? gapOf(cg, hourlyLevel, mean) : null;
    return {
      category, n: { F: cg.F.length, M: cg.M.length }, published,
      meanHourly: published ? { F: mean(cg.F.map(hourlyLevel)), M: mean(cg.M.map(hourlyLevel)) } : null,
      gapMean,
      gapMedian: published ? gapOf(cg, hourlyLevel, median) : null,
      gapBaseMean: gapMean,
      gapVariableMean: published ? gapOf(cg, hourlyVar, mean) : null,
      gapTotalMean: published ? gapOf(cg, hourlyTotal, mean) : null,
      overThreshold: gapMean !== null && Math.abs(gapMean) >= JOINT_ASSESSMENT_THRESHOLD
    };
  });

  return {
    headcount: workers.length,
    counted: { F: g.F.length, M: g.M.length },
    excluded: { notDeclared: valid.length - inScope.length, noHours: workers.length - valid.length },
    method: METHOD,
    gapMean: gapOf(g, hourlyLevel, mean),
    gapTotalMean: gapOf(g, hourlyTotal, mean),
    gapMedian: gapOf(g, hourlyLevel, median),
    gapVariableMean: gapOf(recipients, hourlyVar, mean),
    gapVariableMedian: gapOf(recipients, hourlyVar, median),
    variableRecipients: { F: share(recipients.F.length, g.F.length), M: share(recipients.M.length, g.M.length) },
    quartiles,
    categories,
    jointAssessmentCandidates: categories.filter(c => c.overThreshold).map(c => c.category)
  };
}

export interface ReportingObligation {
  required: boolean;
  frequency: 'annuale' | 'triennale' | null;
  firstDeadline: string | null;
  note: string;
}

/** Obbligo di comunicazione del divario per dimensione (D.Lgs. 96/2026, art. 9, c. 8–9). */
export function reportingObligation(headcount: number): ReportingObligation {
  if (headcount >= 250) return { required: true, frequency: 'annuale', firstDeadline: '2027-06-07', note: 'Poi ogni anno.' };
  if (headcount >= 150) return { required: true, frequency: 'triennale', firstDeadline: '2027-06-07', note: 'Poi ogni tre anni.' };
  if (headcount >= 100) return { required: true, frequency: 'triennale', firstDeadline: '2031-06-07', note: 'Poi ogni tre anni.' };
  return { required: false, frequency: null, firstDeadline: null, note: 'Sotto i 100 dipendenti la comunicazione non è obbligatoria (restano diritto di informazione e trasparenza in assunzione).' };
}
