// Esegue il prototipo v1.3.0 (js/data.js + js/app.js) con un DOM finto e salva i risultati
// del suo motore come riferimento: il nuovo motore deve riprodurli esattamente.
// Uso: node packages/engine/test/fixtures/make-golden.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('../../../../', import.meta.url);
const el = () => new Proxy({}, {
  get: (t, k) => (k in t ? t[k] : k === 'querySelectorAll' ? () => [] : k === 'dataset' ? (t.dataset = {}) : typeof k === 'string' ? (() => el()) : undefined),
  set: (t, k, v) => ((t[k] = v), true)
});
const ctx = {
  document: { querySelector: () => el(), querySelectorAll: () => [], documentElement: { dataset: { theme: 'light' } }, body: el(), createElement: () => el(), title: '' },
  location: { hash: '' }, localStorage: { getItem: () => null, setItem: () => {} },
  addEventListener: () => {}, matchMedia: () => ({ matches: false }), setTimeout, clearTimeout
};
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['js/data.js', 'js/app.js']) vm.runInContext(readFileSync(new URL(f, root), 'utf8'), ctx, { filename: f });

const D = ctx.window.SDU_DATA;
const golden = D.people.map(p => ({ id: p.id, mat: p.mat, g: p.g, fn: p.fn, band: p.band, co: p.co, ore: p.ore, costo: p.costo, f: p.f,
  score: p.score, level: p.level, priority: p.priority, dev: p.dev, drivers: p.drivers.map(d => [d.k, d.pts]) }));
writeFileSync(new URL('golden-v1.3.0.json', import.meta.url), JSON.stringify({ bands: D.bands, people: golden }, null, 1));
console.log(golden.length, 'persone nel riferimento');
