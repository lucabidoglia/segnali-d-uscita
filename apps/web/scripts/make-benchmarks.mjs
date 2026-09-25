// Costruisce src/lib/benchmarks.json: medie di mercato ufficiali per l'Italia, ognuna con fonte e anno.
//  - Eurostat SES 2022 (stessa indagine di ISTAT "Struttura delle retribuzioni"): scaricata in diretta dall'API
//  - INPS Osservatorio dipendenti privati, anno 2024 (PDF novembre 2025): trascritta sotto
//  - ISTAT Struttura delle retribuzioni 2022 (report 20/1/2025): valori non presenti in Eurostat (es. aziende ≥ 1.000)
//  - CCNL: minimi tabellari mensili per livello (non sono medie di mercato)
// Uso: node scripts/make-benchmarks.mjs
import { writeFileSync } from 'node:fs';

const SOURCES = {
  eurostat: { name: 'Eurostat — Structure of Earnings Survey 2022 (Italia)', year: 2022, url: 'https://ec.europa.eu/eurostat/web/labour-market/database',
    note: 'Unità con almeno 10 dipendenti, ottobre 2022. Retribuzione oraria lorda (esclusi pagamenti irregolari, inclusi straordinari). Annua: riportata a tempo pieno e anno intero. Settori B–S esclusa la Pubblica Amministrazione, salvo dove indicato.' },
  istat: { name: 'ISTAT — La struttura delle retribuzioni in Italia, anno 2022', year: 2022, url: 'https://www.istat.it/wp-content/uploads/2025/01/REPORT_STRUTTURA_RETRIBUZIONI_2022.pdf',
    note: 'Stessa indagine SES 2022, include la Pubblica Amministrazione (sezioni B–S). Retribuzione oraria di ottobre 2022.' },
  inps: { name: 'INPS — Osservatorio lavoratori dipendenti del settore privato, anno 2024', year: 2024, url: 'https://servizi2.inps.it/servizi/osservatoristatistici/api/getAllegato/?idAllegato=1043',
    note: 'Imponibile previdenziale medio annuo per lavoratore. NON riportato a tempo pieno e anno intero: include part-time e rapporti brevi, quindi è più basso di una RAL a tempo pieno. Tra parentesi le giornate medie retribuite (anno pieno = 312).' },
  ccnl_metal: { name: 'CCNL Metalmeccanici Industria (Federmeccanica-Assistal), rinnovo 22/11/2025 — minimi dal 1/6/2026', year: 2026, url: 'https://www.fiscoetasse.com/approfondimenti/16929-ccnl-metalmeccanici-industria-2025-novita-aumenti-e-welfare.html',
    note: 'Minimo tabellare mensile lordo per livello. È un minimo contrattuale, non una media. Verificare sul testo ufficiale del CCNL.' },
  ccnl_terziario: { name: 'CCNL Terziario Distribuzione Servizi (Confcommercio), rinnovo 22/3/2024 — paga base dal 1/11/2026', year: 2026, url: 'https://www.hrcapital.it/pubblicazioni/ccnl-terziario-distribuzione-e-servizi-nuovi-minimi-tabellari-e-aumenti-retributivi-dal-2026/',
    note: 'Paga base tabellare mensile lorda per livello, ESCLUSE indennità di contingenza ed EDR: il minimo effettivo è più alto. 14 mensilità. Verificare sul testo ufficiale del CCNL.' },
};

const ISCO = { TOTAL: 'Tutte le professioni', 'OC1-5': 'Lavoratori non manuali', OC1: 'Dirigenti', OC2: 'Professioni intellettuali e scientifiche', OC3: 'Professioni tecniche',
  OC4: "Impiegati d'ufficio", OC5: 'Professioni commerciali e dei servizi', OC6: 'Agricoltura, foreste e pesca (specializzati)', 'OC7-9': 'Lavoratori manuali',
  OC7: 'Artigiani e operai specializzati', OC8: 'Conduttori di impianti e macchinari, montaggio', OC9: 'Professioni non qualificate', OC0: 'Forze armate' };
const NACE = { 'B-S': 'Totale economia (B–S)', 'B-S_X_O': 'Totale escl. Pubblica Amministrazione', 'B-E': 'Industria in senso stretto (B–E)', B: 'B · Estrazione di minerali', C: 'C · Attività manifatturiere',
  D: 'D · Energia elettrica e gas', E: 'E · Acqua, reti fognarie, rifiuti', F: 'F · Costruzioni', G: 'G · Commercio; riparazione autoveicoli', H: 'H · Trasporto e magazzinaggio',
  I: 'I · Alloggio e ristorazione', J: 'J · Informazione e comunicazione', K: 'K · Attività finanziarie e assicurative', L: 'L · Attività immobiliari',
  M: 'M · Attività professionali, scientifiche e tecniche', N: 'N · Noleggio, agenzie di viaggio, servizi alle imprese', O: 'O · Pubblica Amministrazione e difesa',
  P: 'P · Istruzione', Q: 'Q · Sanità e assistenza sociale', R: 'R · Attività artistiche, sportive, di intrattenimento', S: 'S · Altre attività di servizi' };
const AGE = { TOTAL: 'Tutte le età', Y_LT30: 'Meno di 30 anni', 'Y30-49': '30–49 anni', Y_GE50: '50 anni e oltre' };
const NUTS = { IT: 'Italia', ITC: 'Nord-ovest', ITH: 'Nord-est', ITI: 'Centro', ITF: 'Sud', ITG: 'Isole' };
const SIZE = { '10-49': '10–49 dipendenti', '50-249': '50–249 dipendenti', '250-499': '250–499 dipendenti', GE10: '10 dipendenti e oltre' };

async function eurostat(ds, filters) {
  const q = Object.entries(filters).flatMap(([k, v]) => [].concat(v).map(x => `${k}=${encodeURIComponent(x)}`)).join('&');
  const r = await fetch(`https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/${ds}?time=2022&lang=EN&${q}`);
  if (!r.ok) throw new Error(`${ds}: HTTP ${r.status}`);
  const d = await r.json();
  const cats = d.id.map(id => Object.entries(d.dimension[id].category.index).sort((a, b) => a[1] - b[1]).map(x => x[0]));
  const rows = [];
  const walk = (k, idx, acc) => {
    if (k === d.id.length) { const v = d.value[idx]; if (v !== undefined) rows.push({ ...acc, value: v }); return; }
    cats[k].forEach((c, i) => walk(k + 1, idx * d.size[k] + i, { ...acc, [d.id[k]]: c }));
  };
  walk(0, 0, {});
  return rows;
}

const rows = [];
const add = (source, dimension, group, measure, bySex, extra = {}) => {
  for (const [sex, value] of Object.entries(bySex)) if (value !== undefined && value !== null) rows.push({ source, dimension, group, sex, measure, value, ...extra });
};
const pivot = (list, key, label, fn) => {
  const m = new Map();
  for (const r of list) { const k = r[key]; if (!m.has(k)) m.set(k, {}); m.get(k)[r.sex] = r.value; }
  for (const [k, v] of m) if (label[k]) fn(label[k], v, k);
};

// ---------------------------------------------------------------- Eurostat
pivot(await eurostat('earn_ses22_rhr', { unit: 'EUR', geo: Object.keys(NUTS) }), 'geo', NUTS, (g, v) => add('eurostat', 'Area geografica', g, 'orario', v));
const ageIsco = await eurostat('earn_ses22_14', { unit: 'EUR', indic_se: 'ERN', sizeclas: 'GE10', geo: 'IT' });
pivot(ageIsco.filter(r => r.isco08 === 'TOTAL' && r.age === 'TOTAL'), 'sizeclas', { GE10: 'Tutti i dipendenti' }, (g, v) => add('eurostat', 'Sesso', g, 'orario', v));
pivot(ageIsco.filter(r => r.isco08 === 'TOTAL'), 'age', AGE, (g, v) => add('eurostat', 'Età', g, 'orario', v));
pivot(ageIsco.filter(r => r.age === 'TOTAL'), 'isco08', ISCO, (g, v) => add('eurostat', 'Professione (ISCO)', g, 'orario', v));
for (const a of ['Y_LT30', 'Y30-49', 'Y_GE50'])
  pivot(ageIsco.filter(r => r.age === a), 'isco08', ISCO, (g, v) => add('eurostat', 'Professione × età', `${g} · ${AGE[a]}`, 'orario', v));
pivot(await eurostat('earn_ses22_13', { unit: 'EUR', indic_se: 'ERN', sizeclas: 'GE10', age: 'TOTAL', geo: 'IT' }), 'nace_r2', NACE, (g, v) => add('eurostat', 'Settore (Ateco)', g, 'orario', v));
const isz = await eurostat('earn_ses22_18', { unit: 'EUR', indic_se: 'ERN', geo: 'IT' });
const asz = await eurostat('earn_ses22_32', { unit: 'EUR', indic_se: 'ERN', geo: 'IT' });
for (const [list, measure] of [[isz, 'orario'], [asz, 'annuo']]) {
  pivot(list.filter(r => r.isco08 === 'TOTAL'), 'sizeclas', SIZE, (g, v) => add('eurostat', 'Dimensione azienda', g, measure, v));
  for (const s of Object.keys(SIZE))
    pivot(list.filter(r => r.sizeclas === s), 'isco08', ISCO, (g, v, code) => add('eurostat', 'Professione × dimensione', `${g} · ${SIZE[s]}`, measure, v, { isco: code, size: s }));
}
// Copertura dei CCNL: in Italia i dipendenti sono di fatto tutti coperti da contratto nazionale (Eurostat earn_ses22_12: valori identici al totale), quindi non è un confronto utile.

// ---------------------------------------------------------------- ISTAT (report 2022, valori non in Eurostat)
add('istat', 'Dimensione azienda', '1.000 dipendenti e oltre', 'orario', { T: 19.2 });
add('istat', 'Anzianità in azienda', '0–4 anni', 'orario', { T: 13.5 });
add('istat', 'Anzianità in azienda', '5–9 anni', 'orario', { T: 15.8 });
add('istat', 'Anzianità in azienda', '10–14 anni', 'orario', { T: 18.4 });
add('istat', 'Anzianità in azienda', '15–19 anni', 'orario', { T: 18.9 });
add('istat', 'Anzianità in azienda', '20–24 anni', 'orario', { T: 19.4 });
add('istat', 'Anzianità in azienda', '25–29 anni', 'orario', { T: 19.9 });
add('istat', 'Anzianità in azienda', '30 anni e oltre', 'orario', { T: 21.6 });
add('istat', 'Titolo di studio', 'Al più licenza media', 'orario', { T: 12.4, F: 11.1, M: 13.1 });
add('istat', 'Titolo di studio', 'Diploma', 'orario', { T: 15.0, F: 14.0, M: 15.7 });
add('istat', 'Titolo di studio', 'Laurea e oltre', 'orario', { T: 22.0, F: 20.3, M: 24.3 });
add('istat', 'Tipo di contratto', 'Tempo indeterminato', 'orario', { T: 17.1 });
add('istat', 'Tipo di contratto', 'Tempo determinato', 'orario', { T: 12.9 });
add('istat', 'Tipo di contratto', 'Tempo pieno', 'orario', { T: 17.3 });
add('istat', 'Tipo di contratto', 'Part-time', 'orario', { T: 12.0 });
for (const [g, F, M, T, fa, ma, ta] of [
  ['Industria in senso stretto (B–E)', 13.8, 16.0, 15.4, 34117, 40370, 38760], ['Costruzioni (F)', 13.1, 13.8, 13.7, 31866, 32247, 32202],
  ['Servizi di mercato (G–N)', 13.3, 15.5, 14.6, 33375, 39380, 36891], ['Altri servizi (O–S)', 18.6, 21.2, 19.6, 34085, 42532, 37356], ['Totale (B–S)', 15.9, 16.8, 16.4, 33807, 39982, 37302]]) {
  add('istat', 'Macrosettore', g, 'orario', { F, M, T });
  add('istat', 'Macrosettore', g, 'annuo', { F: fa, M: ma, T: ta });
}

// ---------------------------------------------------------------- INPS 2024 (Prospetti 1–5)
for (const [g, v, gg] of [['Operai', 18227, 231], ['Impiegati', 27797, 267], ['Quadri', 72279, 301], ['Dirigenti', 163643, 297], ['Apprendisti', 14610, 229], ['Totale', 24486, 247]])
  add('inps', 'Qualifica', g, 'annuo', { T: v }, { days: gg });
for (const [g, M, F, T] of [['Fino a 19 anni', 5142, 3151, 4374], ['20–24', 13652, 9402, 11882], ['25–29', 20218, 16122, 18436], ['30–34', 24721, 18892, 22178], ['35–39', 27681, 19745, 24222],
  ['40–44', 30465, 21499, 26481], ['45–49', 32621, 22764, 28202], ['50–54', 35155, 24026, 30278], ['55–59', 35705, 24096, 30901], ['60–64', 34355, 22842, 29984], ['65 e oltre', 23620, 16475, 21125], ['Totale', 27967, 19833, 24486]])
  add('inps', 'Età', g, 'annuo', { F, M, T });
for (const [g, v, gg] of [['Nord-ovest', 28852, 257], ['Nord-est', 25723, 252], ['Centro', 23850, 246], ['Sud', 18254, 228], ['Isole', 17898, 228], ['Italia', 24486, 247]])
  add('inps', 'Area geografica', g, 'annuo', { T: v }, { days: gg });
for (const [g, v, gg] of [['Tempo indeterminato', 29594, 282], ['Tempo determinato', 10752, 153], ['Stagionale', 8706, 119]])
  add('inps', 'Tipo di contratto', g, 'annuo', { T: v }, { days: gg });
for (const [g, v, gg] of [['B · Estrazione di minerali', 51530, 289], ['C · Attività manifatturiere', 32487, 277], ['D · Energia elettrica e gas', 50015, 296], ['E · Acqua, reti fognarie, rifiuti', 30525, 283],
  ['F · Costruzioni', 22106, 233], ['G · Commercio; riparazione autoveicoli', 23577, 261], ['H · Trasporto e magazzinaggio', 27199, 261], ['I · Alloggio e ristorazione', 11233, 183],
  ['J · Informazione e comunicazione', 35227, 260], ['K · Attività finanziarie e assicurative', 56429, 297], ['L · Attività immobiliari', 25738, 261], ['M · Attività professionali, scientifiche e tecniche', 28855, 264],
  ['N · Noleggio, agenzie di viaggio, servizi alle imprese', 16485, 220], ['P · Istruzione', 16451, 215], ['Q · Sanità e assistenza sociale', 18720, 257], ['R · Attività artistiche, sportive, di intrattenimento', 15628, 164],
  ['S · Altre attività di servizi', 17527, 240], ['Totale', 24486, 247]])
  add('inps', 'Settore (Ateco)', g, 'annuo', { T: v }, { days: gg });

// ---------------------------------------------------------------- CCNL (minimi mensili per livello)
for (const [g, v] of [['D1', 1784.94], ['D2', 1979.37], ['C1', 2022.12], ['C2', 2064.88], ['C3', 2211.43], ['B1', 2370.33], ['B2', 2542.98], ['B3', 2838.99], ['A1', 2907.01]])
  add('ccnl_metal', 'CCNL Metalmeccanici Industria', `Livello ${g}`, 'minimo mensile', { T: v });
for (const [g, v] of [['Quadri', 2243.85], ['I', 2021.28], ['II', 1748.39], ['III', 1494.41], ['IV', 1292.46], ['V', 1167.69], ['VI', 1048.33], ['VII', 897.53]])
  add('ccnl_terziario', 'CCNL Terziario Confcommercio', `Livello ${g}`, 'paga base mensile', { T: v });

const out = { generated: new Date().toISOString().slice(0, 10), sources: SOURCES, rows };
writeFileSync(new URL('../src/lib/benchmarks.json', import.meta.url), JSON.stringify(out));
const dims = [...new Set(rows.map(r => r.dimension))];
console.log(rows.length, 'valori in', dims.length, 'dimensioni:', dims.join(' | '));
