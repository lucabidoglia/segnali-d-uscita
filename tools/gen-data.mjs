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
  { nome: 'Sede Uffici', area: 'Uffici' },
  { nome: 'Stabilimento Produzione', area: 'Produzione' },
  { nome: 'Reparto Manutenzione', area: 'Produzione' },
  { nome: 'Centro Logistico', area: 'Logistica' },
  { nome: 'Magazzino Est', area: 'Logistica' }
];
// funzione, banda, RAL media, mansioni, peso, strutture ammesse (indici), quota femminile
const FN = [
  { fn: 'DIREZIONE', band: 'D', ral: 85000, mans: ['DIRETTORE GENERALE', 'DIRETTORE OPERATIONS', 'DIRETTORE FINANZIARIO'], w: 3, st: [0], qf: 0.33 },
  { fn: 'AMMINISTRAZIONE E FINANZA', band: 'B', ral: 34000, mans: ['CONTROLLER', 'CONTABILE', 'ADDETTO PAGHE', 'ADDETTO TESORERIA'], w: 9, st: [0], qf: 0.72 },
  { fn: 'RISORSE UMANE', band: 'B', ral: 33000, mans: ['HR BUSINESS PARTNER', 'RECRUITER', 'ADDETTO AMM. PERSONALE'], w: 4, st: [0], qf: 0.8 },
  { fn: 'COMMERCIALE', band: 'B', ral: 38000, mans: ['ACCOUNT MANAGER', 'AGENTE COMMERCIALE', 'RESP. VENDITE'], w: 8, st: [0], qf: 0.42 },
  { fn: 'CUSTOMER SERVICE', band: 'A', ral: 27000, mans: ['ADDETTO CUSTOMER CARE', 'ADDETTO ORDINI'], w: 6, st: [0], qf: 0.78 },
  { fn: 'MARKETING', band: 'B', ral: 34000, mans: ['MARKETING SPECIALIST', 'BRAND MANAGER', 'GRAFICO'], w: 3, st: [0], qf: 0.65 },
  { fn: 'IT', band: 'C', ral: 42000, mans: ['SYSTEM ADMINISTRATOR', 'SVILUPPATORE', 'HELP DESK'], w: 4, st: [0], qf: 0.2 },
  { fn: 'ACQUISTI', band: 'B', ral: 35000, mans: ['BUYER', 'ADDETTO ACQUISTI'], w: 3, st: [0], qf: 0.5 },
  { fn: 'QUALITA', band: 'C', ral: 40000, mans: ['RESP. QUALITÀ', 'ADDETTO CONTROLLO QUALITÀ', 'RSPP'], w: 4, st: [0, 1], qf: 0.5 },
  { fn: 'PRODUZIONE', band: 'A', ral: 28000, mans: ['OPERAIO DI LINEA', 'OPERATORE MACCHINE CNC', 'ADDETTO ASSEMBLAGGIO', 'CAPO TURNO'], w: 26, st: [1], qf: 0.3 },
  { fn: 'MANUTENZIONE', band: 'B', ral: 33000, mans: ['MANUTENTORE MECCANICO', 'ELETTRICISTA INDUSTRIALE'], w: 5, st: [2], qf: 0.05 },
  { fn: 'LOGISTICA', band: 'A', ral: 26000, mans: ['MAGAZZINIERE', 'CARRELLISTA', 'ADDETTO PICKING', 'AUTISTA', 'CAPO MAGAZZINO'], w: 22, st: [3, 4], qf: 0.22 }
];
const FORM_UFF = ['Excel avanzato', 'Lingua inglese livello B1', 'GDPR e cybersecurity', 'Leadership e gestione dei team', 'Project management base'];
const livelloOf = (f, mans) => /CAPO/.test(mans) ? '5' : f.band === 'D' ? 'Dirigente' : f.band === 'C' ? pick(['7', 'Quadro']) : f.band === 'B' ? pick(['5', '6', '6', '7']) : pick(['3', '3', '4']);
const N = 180, people = [], used = new Set();
for (let i = 0; i < N; i++) {
  const f = wpick(FN, FN.map(x => x.w));
  const female = rnd() < f.qf;
  let nome; do { nome = (female ? pick(F) : pick(M)) + ' ' + pick(L); } while (used.has(nome)); used.add(nome);
  const st = ST[pick(f.st)];
  const anz = Math.round((rnd() ** 1.4 * 16 + 0.3) * 10) / 10;
  const fte = wpick([1, 0.75, 0.6, 0.5], [55, 20, 15, 10]);
  const mk = f.ral * 1.38 / 1730;
  const dev = (rnd() - 0.5) * 0.36 + (female ? -0.015 : 0.015) + Math.min(anz, 12) * 0.006 - 0.036;
  const co = Math.round(mk * (1 + dev) * 100) / 100;
  const sat = wpick([1, 2, 3, 4, 5], [7, 16, 30, 32, 15]);
  const mans = pick(f.mans), ostr = rnd() < (['PRODUZIONE', 'LOGISTICA'].includes(f.fn) ? 0.6 : 0.3) ? Math.round(rnd() * 70 * fte) : 0;
  const ore = Math.round((865 * fte * (0.97 + rnd() * 0.05) + ostr) * 10) / 10;
  const formed = rnd() < 0.7;
  const titolo = /CARRELLISTA/.test(mans) ? 'Abilitazione alla conduzione di carrelli elevatori' : ['PRODUZIONE', 'MANUTENZIONE'].includes(f.fn) ? pick(['Sicurezza sul lavoro — aggiornamento', 'Lean manufacturing', 'Gestione qualità ISO 9001']) : f.fn === 'LOGISTICA' ? pick(['Sicurezza sul lavoro — aggiornamento', 'Gestione del magazzino WMS']) : pick(FORM_UFF);
  people.push({
    mat: String(1000 + i * 7 + Math.floor(rnd() * 6)).padStart(7, '0'), nome: nome.toUpperCase(), g: female ? 'F' : 'M',
    fn: f.fn, mans, st: st.nome, area: st.area, band: f.band, livello: livelloOf(f, mans),
    tip: wpick(['Dipendente', 'Somministrato'], [92, 8]), anz, fte,
    ral: Math.round(co * 1730 * fte / 1.38 / 100) * 100, co, ore, ostr, costo: Math.round(co * ore * 100) / 100,
    form: formed ? { titolo, ore: pick([8, 12, 16, 24, 32, 40]), da: '2026-0' + (2 + Math.floor(rnd() * 4)) + '-' + String(3 + Math.floor(rnd() * 20)).padStart(2, '0') } : null,
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
  meta: { azienda: 'Orizzonte Industrie S.p.A. (demo)', periodo: 'gennaio–giugno 2026', generato: '2026-09-20', dimostrativo: true },
  bands: [
    { id: 'A', nome: 'Operativo', min: 22000, media: 27000, max: 33000 }, { id: 'B', nome: 'Impiegati & Specialisti', min: 29000, media: 35000, max: 45000 },
    { id: 'C', nome: 'Tecnici & Coordinamento', min: 36000, media: 46000, max: 60000 }, { id: 'D', nome: 'Management', min: 55000, media: 72000, max: 95000 }
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
