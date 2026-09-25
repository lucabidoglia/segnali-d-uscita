// Controlla se la normativa sull'equità retributiva è cambiata, confrontando le fonti ufficiali con l'ultima versione verificata.
//   node scripts/check-normativa.mjs           → controlla; se una fonte cambia segna la pagina «in verifica» e stampa CHANGED
//   node scripts/check-normativa.mjs --accept  → dopo aver aggiornato src/lib/normativa.ts: registra le fonti attuali come verificate
// Fonti:
//   - D.Lgs. 96/2026: testo vigente in formato Akoma Ntoso da Normattiva (solo il testo degli articoli, non i metadati)
//   - Direttiva (UE) 2023/970: atti che la modificano, rettificano o abrogano, dal servizio SPARQL dell'Ufficio pubblicazioni UE
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = new URL('../src/lib/normativa-watch.json', import.meta.url);
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; segnali-uscita-normativa-watch)' };
const today = new Date().toISOString().slice(0, 10);
const sha = s => createHash('sha256').update(s).digest('hex');

async function normattiva({ dataGU, codiceRedaz, urn }) {
  // prima pagina per ottenere il cookie di sessione, poi il testo vigente oggi
  const first = await fetch(`https://www.normattiva.it/uri-res/N2Ls?${urn}`, { headers: UA });
  if (!first.ok) throw new Error(`Normattiva HTTP ${first.status}`);
  const cookie = (first.headers.getSetCookie?.() ?? []).map(c => c.split(';')[0]).join('; ');
  const r = await fetch(`https://www.normattiva.it/do/atto/caricaAKN?dataGU=${dataGU}&codiceRedaz=${codiceRedaz}&dataVigenza=${today.replace(/-/g, '')}`, { headers: { ...UA, cookie } });
  if (!r.ok) throw new Error(`Normattiva AKN HTTP ${r.status}`);
  const xml = await r.text();
  const body = xml.slice(xml.indexOf('<body'), xml.lastIndexOf('</body>'));
  if (!body.includes('art_1')) throw new Error('Normattiva: testo degli articoli non trovato');
  const text = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return { fingerprint: sha(text), detail: `${(body.match(/<article/g) ?? []).length} articoli` };
}

async function eurlexAmendments({ celex }) {
  const q = `PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
SELECT DISTINCT ?celex ?rel WHERE { ?w cdm:resource_legal_id_celex "${celex}"^^<http://www.w3.org/2001/XMLSchema#string> .
 { ?x cdm:resource_legal_amends_resource_legal ?w . BIND("modifica" AS ?rel) } UNION { ?x cdm:resource_legal_corrects_resource_legal ?w . BIND("rettifica" AS ?rel) }
 UNION { ?x cdm:resource_legal_repeals_resource_legal ?w . BIND("abroga" AS ?rel) } ?x cdm:resource_legal_id_celex ?celex . }`;
  const r = await fetch(`https://publications.europa.eu/webapi/rdf/sparql?query=${encodeURIComponent(q)}`, { headers: { ...UA, Accept: 'application/sparql-results+json' } });
  if (!r.ok) throw new Error(`EU SPARQL HTTP ${r.status}`);
  const list = (await r.json()).results.bindings.map(b => `${b.rel.value} ${b.celex.value}`).sort();
  return { fingerprint: sha(JSON.stringify(list)), detail: list.join(', ') || 'nessun atto' };
}

const CHECKS = {
  normattiva: normattiva,
  eurlex: eurlexAmendments,
};

const state = JSON.parse(readFileSync(FILE, 'utf8'));
const accept = process.argv.includes('--accept');
const changed = [];
for (const s of state.sources) {
  const now = await CHECKS[s.kind](s.params);
  if (accept) Object.assign(s, { fingerprint: now.fingerprint, detail: now.detail, verifiedOn: today });
  else if (s.fingerprint !== now.fingerprint) changed.push({ id: s.id, name: s.name, before: s.detail, now: now.detail });
  console.log(`${s.fingerprint === now.fingerprint ? 'uguale  ' : accept ? 'accettata' : 'CAMBIATA'} ${s.name} — ${now.detail}`);
}
// il file cambia solo quando cambia qualcosa: nessun commit settimanale inutile
if (accept) { state.pending = null; state.checkedOn = today; writeFileSync(FILE, JSON.stringify(state, null, 2) + '\n'); }
else if (changed.length && !state.pending) { state.pending = { since: today, sources: changed }; state.checkedOn = today; writeFileSync(FILE, JSON.stringify(state, null, 2) + '\n'); }
if (changed.length && !accept) console.log('CHANGED');
