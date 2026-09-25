// Converte i dati INVENTATI del prototipo (js/data.js) nel formato del modello Excel, per provare l'import.
// Uso: node scripts/make-demo.mjs
import { readFileSync, writeFileSync } from 'node:fs';
const src = readFileSync(new URL('../../../js/data.js', import.meta.url), 'utf8');
const D = JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1));
const h = s => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) / 4294967296; // pseudo-casuale stabile
const rows = D.people.map(p => {
  const base = Math.round(p.costo / 1.38 * 100) / 100;
  const r = h(p.mat);
  const senior = /DIRETTORE|RESP\.|CAPO|MANAGER/.test(p.mans) || ['Quadro', 'Dirigente'].includes(p.livello);
  const variable = senior ? Math.round(base * (0.06 + r * 0.06)) : r < 0.3 ? Math.round(base * 0.02) : 0;
  return { id: p.mat, fullName: p.nome, gender: p.g, category: p.fn, funzione: p.fn, mansione: p.mans, sede: p.st, area: p.area,
    livello: p.livello, fte: p.fte, hoursPaid: p.ore, basePay: base, variablePay: variable, employerCost: p.costo, seniorityYears: p.anz };
});
writeFileSync(new URL('../src/lib/demo-rows.json', import.meta.url), JSON.stringify(rows));
console.log(rows.length, 'righe demo');
