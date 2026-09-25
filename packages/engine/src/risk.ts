/**
 * Motore del rischio di uscita. Porta 1:1 il modello del prototipo (v1.3.0) ma con pesi
 * versionati: ogni punteggio salvato deve riportare `model.version`, così resta spiegabile
 * e riproducibile (GDPR art. 22 e trasparenza verso il lavoratore).
 *
 * È un sistema a regole definite da persone, non un modello statistico addestrato:
 * se in futuro lo diventasse, ricade tra i sistemi ad alto rischio dell'AI Act (All. III, punto 4).
 */
export interface RiskFactors {
  sat: 1 | 2 | 3 | 4 | 5;
  load: 1 | 2 | 3 | 4 | 5;
  promo: number;
  extra: number;
  recog: number;
  behav: number;
  mobil: number;
  market: number;
  /** Punti retribuzione inseriti a mano, usati solo se manca il confronto con il mercato. */
  comp?: number;
  perf: 0 | 1 | 2;
  crit: 0 | 1 | 2;
}

export type DriverKey = 'sat' | 'promo' | 'extra' | 'recog' | 'comp' | 'load' | 'behav' | 'market' | 'mobil';

export interface RiskModel {
  version: string;
  sat: Record<number, number>;
  load: Record<number, number>;
  /** Punti retribuzione in funzione dello scostamento % dal mercato. */
  compFromDeviation: (devPct: number) => number;
  rawMin: number;
  rawMax: number;
  levels: { high: number; medium: number };
  labels: Record<DriverKey, string>;
}

export const RISK_MODEL_V1: RiskModel = {
  version: '1.0.0',
  sat: { 1: 20, 2: 12, 3: 0, 4: -7, 5: -14 },
  load: { 1: -4, 2: -2, 3: 0, 4: 8, 5: 14 },
  compFromDeviation: d => (d < -15 ? 18 : d < -7 ? 12 : d < -2 ? 5 : d > 7 ? -8 : 0),
  rawMin: -26,
  rawMax: 90,
  levels: { high: 70, medium: 40 },
  labels: {
    sat: 'Soddisfazione', promo: 'Crescita ferma', extra: 'Straordinari', recog: 'Riconoscimento', comp: 'Retribuzione',
    load: 'Carico', behav: 'Comportamento', market: 'Mercato esterno', mobil: 'Mobilità interna'
  }
};

export type RiskLevel = 'Alto' | 'Medio' | 'Basso';
export type Priority = 'Critica' | 'Alta' | 'Media' | 'Bassa';

export interface RiskResult {
  modelVersion: string;
  score: number;
  level: RiskLevel;
  priority: Priority;
  /** Scostamento % dal mercato, se calcolabile. */
  marketDeviation: number | null;
  drivers: { key: DriverKey; label: string; points: number }[];
}

/**
 * @param hourly  costo o retribuzione oraria della persona
 * @param market  riferimento di mercato sulla stessa base di `hourly`
 */
export function computeRisk(f: RiskFactors, hourly?: number, market?: number, model: RiskModel = RISK_MODEL_V1): RiskResult {
  let comp = f.comp ?? 0;
  let dev: number | null = null;
  if (hourly && hourly > 0 && market && market > 0) {
    dev = ((hourly - market) / market) * 100;
    comp = model.compFromDeviation(dev);
  }
  const dr: [DriverKey, number][] = [
    ['sat', model.sat[f.sat] ?? 0], ['promo', f.promo], ['extra', f.extra], ['recog', f.recog], ['comp', comp],
    ['load', model.load[f.load] ?? 0], ['behav', f.behav], ['market', f.market], ['mobil', f.mobil]
  ];
  const raw = dr.reduce((a, d) => a + d[1], 0);
  const score = Math.max(0, Math.min(100, Math.round(((raw - model.rawMin) / (model.rawMax - model.rawMin)) * 100)));
  const level: RiskLevel = score >= model.levels.high ? 'Alto' : score >= model.levels.medium ? 'Medio' : 'Basso';
  const ps = (level === 'Alto' ? 3 : level === 'Medio' ? 2 : 1) + f.perf + f.crit;
  const priority: Priority = ps >= 6 ? 'Critica' : ps >= 5 ? 'Alta' : ps >= 3 ? 'Media' : 'Bassa';
  const drivers = dr
    .filter(d => d[1] !== 0)
    .map(([key, points]) => ({ key, label: model.labels[key], points }))
    .sort((a, b) => Math.abs(b.points) - Math.abs(a.points));
  return { modelVersion: model.version, score, level, priority, marketDeviation: dev, drivers };
}

export interface FairnessCheck {
  meanScore: { F: number; M: number };
  highShare: { F: number; M: number };
  /** Rapporto tra le quote "rischio alto" (minore ÷ maggiore). Sotto 0,8 = squilibrio da indagare (regola dei 4/5). */
  highShareRatio: number | null;
  flagged: boolean;
}

/** Verifica che il punteggio non penalizzi sistematicamente un genere. */
export function fairnessByGender(items: readonly { gender: string; score: number; level: RiskLevel }[]): FairnessCheck {
  const grp = (g: string) => items.filter(i => i.gender === g);
  const F = grp('F'), M = grp('M');
  const m = (a: typeof F) => (a.length ? a.reduce((s, i) => s + i.score, 0) / a.length : NaN);
  const h = (a: typeof F) => (a.length ? (a.filter(i => i.level === 'Alto').length / a.length) * 100 : NaN);
  const hF = h(F), hM = h(M);
  const hi = Math.max(hF, hM);
  const ratio = Number.isFinite(hi) && hi > 0 ? Math.min(hF, hM) / hi : null;
  return { meanScore: { F: m(F), M: m(M) }, highShare: { F: hF, M: hM }, highShareRatio: ratio, flagged: ratio !== null && ratio < 0.8 };
}
