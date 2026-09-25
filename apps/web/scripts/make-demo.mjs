// Converte i dati INVENTATI del prototipo (js/data.js) nel formato del modello Excel, per provare l'import.
// Uso: node scripts/make-demo.mjs
import { readFileSync, writeFileSync } from 'node:fs';
const src = readFileSync(new URL('../../../js/data.js', import.meta.url), 'utf8');
const D = JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1));
const h = s => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) / 4294967296; // pseudo-casuale stabile
const LAB = { // valori → etichette del foglio "Fattori rischio"
  promo: { 0: 'No', 8: 'Ferma', 16: 'Bloccata' }, extra: { 0: 'Normali', 6: 'Elevati', 12: 'Molto elevati' },
  recog: { 0: 'Adeguato', 8: 'Scarso', 16: 'Assente' }, behav: { 0: 'Nessuno', 10: 'Disimpegno', 20: 'Ritiro' },
  mobil: { 0: 'Non richiesta', 6: 'Richiesta', 12: 'Bloccata' }, market: { 0: 'Debole', 4: 'Normale', 8: 'Molto attivo' },
  perf: { 0: 'Standard', 1: 'Alta', 2: 'Eccellente' }, crit: { 0: 'Sostituibile', 1: 'Importante', 2: 'Critica' }
};
const itDate = s => s.split('-').reverse().join('/');
const rows = D.people.map(p => {
  const base = Math.round(p.costo / 1.38 * 100) / 100;
  const r = h(p.mat);
  const senior = /DIRETTORE|RESP\.|CAPO|MANAGER/.test(p.mans) || ['Quadro', 'Dirigente'].includes(p.livello);
  const variable = senior ? Math.round(base * (0.06 + r * 0.06)) : r < 0.3 ? Math.round(base * 0.02) : 0;
  return { id: p.mat, fullName: p.nome, gender: p.g, category: p.fn, funzione: p.fn, mansione: p.mans, sede: p.st, area: p.area,
    livello: p.livello, fte: p.fte, hoursPaid: p.ore, basePay: base, variablePay: variable, employerCost: p.costo, seniorityYears: p.anz,
    trainingTitle: p.form?.titolo, trainingHours: p.form?.ore, trainingStart: p.form ? itDate(p.form.da) : undefined };
});
const factors = D.people.map(p => ({ id: p.mat, sat: String(p.f.sat), load: String(p.f.load),
  ...Object.fromEntries(Object.entries(LAB).map(([k, m]) => [k, m[p.f[k]]])) }));
const bandOf = Object.fromEntries(D.funzioni.map(f => [f.fn, D.bands.find(b => b.id === f.band).media]));
const market = D.funzioni.map(f => ({ funzione: f.fn, annual_pay: bandOf[f.fn] }));
writeFileSync(new URL('../src/lib/demo.json', import.meta.url), JSON.stringify({ periodo: { da: '2026-01-01', a: '2026-06-30' }, rows, factors, market }));
console.log(rows.length, 'righe demo,', market.length, 'riferimenti di mercato');
