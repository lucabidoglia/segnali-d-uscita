// Genera js/data.js con dati INVENTATI (generatore deterministico con seed fisso).
import { writeFileSync } from 'node:fs';
let s = 20260920;
const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
const pick = a => a[Math.floor(rnd() * a.length)];
const wpick = (vals, w) => { let r = rnd() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < vals.length; i++) { if ((r -= w[i]) < 0) return vals[i]; } return vals.at(-1); };
const F = ['Giulia','Martina','Sara','Chiara','Elena','Francesca','Alice','Federica','Valentina','Silvia','Laura','Paola','Irene','Marta','Anna','Beatrice','Elisa','Camilla','Noemi','Ilaria'];
const M = ['Marco','Luca','Andrea','Matteo','Davide','Simone','Paolo','Stefano','Lorenzo','Riccardo','Fabio','Giorgio','Tommaso','Nicola','Daniele'];
const L = ['Rossi','Bianchi','Ferrari','Esposito','Romano','Colombo','Ricci','Marino','Greco','Bruno','Gallo','Conti','De Luca','Mancini','Costa','Giordano','Rizzo','Lombardi','Moretti','Barbieri','Fontana','Santoro','Mariani','Rinaldi','Caruso','Ferrara','Galli','Martini','Leone','Longo','Gentile','Martinelli','Vitale','Serra','Coppola','De Santis','Marchetti','Parisi','Villa','Conte','Ferri','Fabbri','Bianco','Marini','Grasso','Valentini','Messina','Sala','De Angelis','Gatti'];
const ST = [
  { nome: 'Sede Centrale', area: 'Area Nord' }, { nome: 'Residenza Aurora', area: 'Area Nord' },
  { nome: 'Centro Diurno Iride', area: 'Area Nord' }, { nome: 'Comunità Ponte', area: 'Area Sud' },
  { nome: 'Servizi Manutenzione', area: 'Area Sud' }
];
// funzione, banda, RAL media, mansioni, peso, strutture ammesse (indici)
const FN = [
  { fn: 'ASSISTENZA', band: 'A', ral: 25000, mans: ['O.S.S.', 'A.S.A.'], w: 40, st: [1, 2, 3] },
  { fn: 'SANITARIO', band: 'B', ral: 35000, mans: ['INFERMIERE', 'FISIOTERAPISTA'], w: 14, st: [1, 2] },
  { fn: 'EDUCATIVO', band: 'B', ral: 32000, mans: ['EDUCATORE', 'ANIMATORE'], w: 16, st: [2, 3] },
  { fn: 'COORDINAMENTO', band: 'C', ral: 46000, mans: ['COORDINATORE'], w: 6, st: [1, 2, 3] },
  { fn: 'AMMINISTRAZIONE', band: 'B', ral: 30000, mans: ['IMPIEGATO AMM.', 'RISORSE UMANE'], w: 10, st: [0] },
  { fn: 'SERVIZI GENERALI', band: 'A', ral: 23000, mans: ['MANUTENTORE', 'ADDETTO PULIZIE', 'PORTIERATO'], w: 10, st: [4, 0] },
  { fn: 'FUNDRAISING', band: 'C', ral: 40000, mans: ['ADDETTO FUNDRAISING'], w: 3, st: [0] },
  { fn: 'DIREZIONE', band: 'D', ral: 72000, mans: ['RESPONSABILE'], w: 2, st: [0] }
];
const N = 140, people = [], used = new Set();
for (let i = 0; i < N; i++) {
  const f = FN[FN.findIndex((_, k) => { return false; })] || wpick(FN, FN.map(x => x.w));
  const female = rnd() < (['COORDINAMENTO', 'DIREZIONE'].includes(f.fn) ? 0.55 : ['SERVIZI GENERALI'].includes(f.fn) ? 0.3 : 0.78);
  let nome; do { nome = (female ? pick(F) : pick(M)) + ' ' + pick(L); } while (used.has(nome)); used.add(nome);
  const st = ST[pick(f.st)];
  const anz = Math.round((rnd() ** 1.4 * 16 + 0.3) * 10) / 10;
  const fte = wpick([1, 0.75, 0.6, 0.5], [55, 20, 15, 10]);
  const mk = f.ral * 1.38 / 1730;
  const dev = (rnd() - 0.5) * 0.36 + (female ? -0.015 : 0.015) + Math.min(anz, 12) * 0.006 - 0.036;
  const co = Math.round(mk * (1 + dev) * 100) / 100;
  const sat = wpick([1, 2, 3, 4, 5], [7, 16, 30, 32, 15]);
  people.push({
    mat: String(1000 + i * 7 + Math.floor(rnd() * 6)).padStart(7, '0'), nome: nome.toUpperCase(), g: female ? 'F' : 'M',
    fn: f.fn, mans: pick(f.mans), st: st.nome, area: st.area, band: f.band,
    tip: wpick(['Dipendente', 'Libero prof.'], [88, 12]), anz, fte,
    ral: Math.round(f.ral * (0.9 + rnd() * 0.25) * fte / 100) * 100, co,
    f: {
      sat, load: wpick([1, 2, 3, 4, 5], [5, 15, 35, 30, 15]),
      promo: wpick([0, 8, 16], anz > 5 ? [35, 30, 35] : [65, 25, 10]),
      extra: wpick([0, 6, 12], [60, 25, 15]), recog: wpick([0, 8, 16], [50, 30, 20]),
      behav: wpick([0, 10, 20], sat <= 2 ? [30, 40, 30] : [80, 15, 5]),
      mobil: wpick([0, 6, 12], [70, 20, 10]), market: wpick([0, 4, 8], f.band === 'B' ? [20, 30, 50] : [50, 30, 20]),
      perf: wpick([0, 1, 2], [30, 45, 25]), crit: wpick([0, 1, 2], f.band === 'A' ? [55, 35, 10] : [30, 40, 30])
    }
  });
}
people.sort((a, b) => a.nome.localeCompare(b.nome));
people.forEach((p, i) => (p.id = i + 1));
const data = {
  meta: { azienda: 'Cooperativa Orizzonte (demo)', periodo: 'gennaio–giugno 2026', generato: '2026-09-20', dimostrativo: true },
  bands: [
    { id: 'A', nome: 'Care & Support', min: 21500, media: 25000, max: 31000 }, { id: 'B', nome: 'Clinical & Specialist', min: 28000, media: 35000, max: 44000 },
    { id: 'C', nome: 'Coordination & Tech', min: 36000, media: 46000, max: 60000 }, { id: 'D', nome: 'Strategy & Mgmt', min: 55000, media: 72000, max: 95000 }
  ],
  strutture: ST, funzioni: FN.map(({ fn, band }) => ({ fn, band })), people,
  casi: [
    { id: 1, ts: '2026-09-02T09:10:00', ref: people[3].nome, score: 78, band: 'Alto', priority: 'Critica', status: 'In corso', note: 'Colloquio fissato con la coordinatrice.' },
    { id: 2, ts: '2026-09-05T15:40:00', ref: people[27].nome, score: 61, band: 'Medio', priority: 'Alta', status: 'Aperto', note: 'Percorso di crescita da definire.' },
    { id: 3, ts: '2026-09-09T11:20:00', ref: people[64].nome, score: 34, band: 'Basso', priority: 'Bassa', status: 'Chiuso', note: 'Nessuna azione necessaria.' }
  ]
};
writeFileSync(new URL('../js/data.js', import.meta.url), 'window.SDU_DATA = ' + JSON.stringify(data) + ';\n');
console.log(people.length, 'persone generate');
