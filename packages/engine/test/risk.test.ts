import { describe, expect, it } from 'vitest';
import golden from './fixtures/golden-v1.3.0.json' with { type: 'json' };
import { computeRisk, fairnessByGender, type RiskFactors } from '../src/index.ts';

const mktHour = (band: string) => {
  const b = golden.bands.find(x => x.id === band)!;
  return Math.round((b.media * 1.38) / 1730 * 100) / 100;
};

describe('motore di rischio: identico al prototipo v1.3.0', () => {
  it.each(golden.people.map(p => [p.mat, p] as const))('matricola %s', (_, p) => {
    const r = computeRisk(p.f as RiskFactors, p.co, mktHour(p.band));
    expect(r.score).toBe(p.score);
    expect(r.level).toBe(p.level);
    expect(r.priority).toBe(p.priority);
    expect(r.drivers.map(d => [d.key, d.points])).toEqual(p.drivers);
  });

  it('registra la versione del modello', () => {
    expect(computeRisk(golden.people[0]!.f as RiskFactors).modelVersion).toBe('1.0.0');
  });

  it('usa i punti retribuzione manuali solo senza confronto di mercato', () => {
    const f: RiskFactors = { sat: 3, load: 3, promo: 0, extra: 0, recog: 0, behav: 0, mobil: 0, market: 0, comp: 18, perf: 0, crit: 0 };
    expect(computeRisk(f).drivers).toEqual([{ key: 'comp', label: 'Retribuzione', points: 18 }]);
    expect(computeRisk(f, 30, 30).drivers).toEqual([]);
  });
});

describe('controllo di equità del punteggio per genere', () => {
  it('segnala uno squilibrio sotto la regola dei 4/5', () => {
    const items = [
      ...Array.from({ length: 10 }, (_, i) => ({ gender: 'F', score: 80, level: (i < 5 ? 'Alto' : 'Basso') as 'Alto' | 'Basso' })),
      ...Array.from({ length: 10 }, (_, i) => ({ gender: 'M', score: 30, level: (i < 2 ? 'Alto' : 'Basso') as 'Alto' | 'Basso' }))
    ];
    const r = fairnessByGender(items);
    expect(r.highShare).toEqual({ F: 50, M: 20 });
    expect(r.highShareRatio).toBeCloseTo(0.4);
    expect(r.flagged).toBe(true);
  });

  it('dati demo: le donne finiscono a rischio alto 2,5 volte più degli uomini → segnalato', () => {
    // In parte è l'effetto del divario retributivo stesso (driver "Retribuzione"): va spiegato nella DPIA.
    const r = fairnessByGender(golden.people.map(p => ({ gender: p.g, score: p.score, level: p.level as 'Alto' })));
    expect(r.highShare.F).toBeCloseTo(17.7, 1);
    expect(r.highShare.M).toBeCloseTo(6.9, 1);
    expect(r.flagged).toBe(true);
  });
});
