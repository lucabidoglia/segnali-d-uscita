import { describe, expect, it } from 'vitest';
import golden from './fixtures/golden-v1.3.0.json' with { type: 'json' };
import { mean, median, payGapReport, reportingObligation, validateWorkers, type Worker } from '../src/index.ts';

const w = (id: string, gender: Worker['gender'], hourlyBase: number, category = 'A', variablePay = 0, hoursPaid = 1000): Worker => ({
  id, gender, category, funzione: category, fte: 1, hoursPaid, basePay: hourlyBase * hoursPaid, variablePay
});

describe('indicatori art. 9 — casi calcolati a mano', () => {
  // Donne 18/20/22 €/h, uomini 20/25/30 €/h, tutto nella stessa categoria
  const ws = [w('f1', 'F', 18), w('f2', 'F', 20, 'A', 2000), w('f3', 'F', 22), w('m1', 'M', 20, 'A', 5000), w('m2', 'M', 25, 'A', 5000), w('m3', 'M', 30)];
  const r = payGapReport(ws);

  it('divario medio sul livello retributivo: solo elementi fissi e continuativi (D.Lgs. 96/2026, art. 3 lett. b)', () => {
    // base oraria F: 18, 20, 22 → 20 · M: 20, 25, 30 → 25
    expect(r.gapMean).toBeCloseTo(20, 6);
    expect(r.method).toMatch(/96\/2026/);
  });
  it('divario mediano sul livello retributivo', () => {
    expect(r.gapMedian).toBeCloseTo(((25 - 20) / 25) * 100, 6);
  });
  it('la retribuzione complessiva (base + variabile) resta solo informativa', () => {
    // F: (18 + 22 + 22) / 3 · M: (25 + 30 + 30) / 3
    expect(r.gapTotalMean).toBeCloseTo(((85 / 3 - 62 / 3) / (85 / 3)) * 100, 6);
    expect(r.categories[0]!.gapTotalMean).toBeCloseTo(r.gapTotalMean!, 6);
  });
  it('componenti variabili: quota di percettori e divario tra percettori', () => {
    expect(r.variableRecipients.F).toBeCloseTo(100 / 3);
    expect(r.variableRecipients.M).toBeCloseTo(200 / 3);
    expect(r.gapVariableMean).toBeCloseTo(((5 - 2) / 5) * 100, 6);
  });
  it('categoria oltre il 5% → candidata alla valutazione congiunta', () => {
    expect(r.categories[0]!.overThreshold).toBe(true);
    expect(r.jointAssessmentCandidates).toEqual(['A']);
  });
  it('quartili sul livello retributivo: 4 gruppi, dal più basso al più alto', () => {
    expect(r.quartiles.map(q => q.n)).toEqual([2, 1, 2, 1]);
    expect(r.quartiles[0]!.shareF).toBe(100);
    expect(r.quartiles[3]!.shareM).toBe(100);
  });
});

describe('tutele', () => {
  it('non pubblica categorie con meno di 3 persone per genere', () => {
    const r = payGapReport([w('f1', 'F', 10), w('f2', 'F', 10), w('m1', 'M', 20), w('m2', 'M', 20), w('m3', 'M', 20)]);
    expect(r.categories[0]).toMatchObject({ published: false, gapMean: null, overThreshold: false });
    expect(r.gapMean).toBeCloseTo(50); // il dato complessivo resta calcolato
  });
  it('esclude genere non dichiarato e ore zero, ma li conteggia', () => {
    const r = payGapReport([w('f1', 'F', 10), w('m1', 'M', 10), w('x', 'ND', 99), { ...w('z', 'M', 10), hoursPaid: 0 }]);
    expect(r.gapTotalMean).toBe(0);
    expect(r.headcount).toBe(4);
    expect(r.excluded).toEqual({ notDeclared: 1, noHours: 1 });
    expect(r.gapMean).toBe(0);
  });
  it('divario negativo quando sono gli uomini a essere pagati meno, anch\'esso ≥ 5% segnalato', () => {
    const r = payGapReport(['1', '2', '3'].flatMap(i => [w('f' + i, 'F', 22), w('m' + i, 'M', 20)]));
    expect(r.gapMean).toBeCloseTo(-10);
    expect(r.jointAssessmentCandidates).toEqual(['A']);
  });
});

describe('coerenza con il prototipo v1.3.0 (stessa base di calcolo)', () => {
  it('divario medio e mediano complessivo uguale alla relazione del prototipo', () => {
    const ws: Worker[] = golden.people.map(p => ({ id: p.mat, gender: p.g as 'F' | 'M', category: p.fn, funzione: p.fn, fte: 1, hoursPaid: 1, basePay: p.co, variablePay: 0 }));
    const r = payGapReport(ws);
    const F = golden.people.filter(p => p.g === 'F').map(p => p.co), M = golden.people.filter(p => p.g === 'M').map(p => p.co);
    expect(r.gapMean).toBeCloseTo(((mean(M) - mean(F)) / mean(M)) * 100, 9);
    expect(r.gapMedian).toBeCloseTo(((median(M) - median(F)) / median(M)) * 100, 9);
  });
});

describe('obbligo di comunicazione per dimensione', () => {
  it.each([
    [99, false, null], [100, true, '2031-06-07'], [149, true, '2031-06-07'], [150, true, '2027-06-07'], [250, true, '2027-06-07']
  ])('%i lavoratori', (n, required, deadline) => {
    const o = reportingObligation(n);
    expect(o.required).toBe(required);
    expect(o.firstDeadline).toBe(deadline);
  });
  it('annuale da 250', () => expect(reportingObligation(250).frequency).toBe('annuale'));
});

describe('validazione dei dati importati', () => {
  it('trova matricole duplicate, genere errato, ore mancanti', () => {
    const bad = [w('1', 'F', 20), w('1', 'M', 20), { ...w('2', 'X' as 'F', 20) }, { ...w('3', 'M', 20), hoursPaid: 0 }];
    const msgs = validateWorkers(bad).filter(i => i.severity === 'errore').map(i => `${i.id}:${i.field}`);
    expect(msgs).toEqual(['1:id', '2:gender', '3:hoursPaid']);
  });
  it('avvisa su importi orari anomali', () => {
    expect(validateWorkers([w('1', 'F', 2)])[0]).toMatchObject({ severity: 'avviso', field: 'basePay' });
  });
});
