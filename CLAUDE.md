# Segnali d'uscita · G1G10

SaaS multi-azienda per l'**equità retributiva** (Direttiva UE 2023/970, recepita dal **D.Lgs. 7 maggio 2026, n. 96**, in vigore dal 7/6/2026) e il **rischio di uscita** delle persone.
Nato da un prototipo statico (v1.3.0, radice del repo), ora industrializzato in `apps/web` + Supabase.

## Il responsabile del progetto
Luca (G1G10) **non è un tecnico**. Con lui: italiano, niente gergo (o spiegato con esempi), domande semplici a scelta chiusa,
istruzioni passo passo quando deve fare qualcosa lui (Supabase, GitHub). Può ricevere solo la chiave **pubblica** Supabase;
password del database e chiave `secret`/`service_role` non passano mai dalla chat.

**Come lavorare con lui** (regole concordate):
- Dopo ogni modifica **completata e verificata** (test, typecheck, lint, build verdi): commit e **push su `main` senza chiedere**; Netlify pubblica da solo. Poi verificare il deploy (vedi «Messa online»).
- Chiedere sempre conferma per azioni irreversibili o verso terzi: cancellare dati, cambiare visibilità del repo (oggi **pubblico**), pagamenti, email.
- Le migrazioni Supabase le applica lui nell'**SQL Editor**: copiare il file negli appunti (`LANG=en_US.UTF-8 pbcopy < file`) e mostrarlo anche in un blocco di codice; link diretto `supabase.com/dashboard/project/ncsxhdfdiotcrkszkevn/sql/new`. Scrivere migrazioni **autosufficienti** (es. `create or replace function` per le funzioni di supporto) per non dipendere dall'ordine di esecuzione.
- Le istruzioni nei siti esterni (Netlify, Supabase, GitHub) vanno verificate sulla documentazione ufficiale prima di darle: i menu cambiano.

## Struttura
| Percorso | Contenuto |
|---|---|
| `apps/web` | App Next.js 16 (App Router, Turbopack, Tailwind 4) + `@supabase/ssr`. **Leggere `apps/web/AGENTS.md`**: Next 16 ha convenzioni nuove (`src/proxy.ts` al posto del middleware, `params`/`searchParams`/`cookies()` asincroni, tipi globali `PageProps`/`LayoutProps`/`RouteContext`) |
| `packages/engine` | Motore di calcolo puro TypeScript (`@g1g10/engine`): divario art. 9, rischio di uscita versionato (`RISK_MODEL_V1`), validazione dati. Import interni con estensione `.ts` |
| `packages/db` | Test RLS delle migrazioni su PostgreSQL in memoria (PGlite) con finto ambiente Supabase (`test/harness.ts`) |
| `supabase/migrations` | Schema del database, in ordine di data |
| `apps/web/scripts/` | `make-demo.mjs` (dati INVENTATI dal prototipo → `src/lib/demo.json`), `make-benchmarks.mjs` (medie di mercato ufficiali → `src/lib/benchmarks.json`), `check-normativa.mjs` (controllo della norma) |
| `docs/` | Guida all'uso per gli utenti: `guida.html` (sorgente) → `Guida_Segnali_d_uscita.pdf` con `docs/make-guida.sh` (Chrome headless); `img/` screenshot reali |
| `netlify.toml` (radice) | Configurazione Netlify dell'**app** (base `apps/web`) |
| radice (`index.html`, `js/`, `css/`, `tools/`) | Prototipo statico v1.3.0 (siti Netlify separati, non collegati a Git): non toccarlo senza motivo |

Ramo di lavoro: **`main`** (il ramo `industrializzazione/motore` è stato unito con la PR #1).

## Messa online
- App: **https://segnali-uscita-app.netlify.app** — Netlify, team `luca-bidoglia` (piano Pro), sito `segnali-uscita-app`
  (id `140d75a3-5bbe-4c83-b694-e807f6afe3d4`). Funzioni e blob a **Francoforte** (`fra`).
- Ogni push su `main` va online da solo (sito collegato al repository GitHub, in ~1 minuto). La configurazione è nel `netlify.toml`
  della **radice** (base `apps/web`, `npm run build`, publish `.next`, `@netlify/plugin-nextjs`) e non dipende dalla UI. Il motore
  `packages/engine` è una dipendenza `file:` fuori dalla base: per questo serve il repository intero.
- **Verificare ogni deploy** con il connettore Netlify (`get-project` → `currentDeploy`, poi `get-deploy-for-site`): `commit_ref` = ultimo commit,
  `framework: next`, 1 funzione, `functions_region: fra`; e con `curl` che `/login` risponda 200 e `/` rimandi a `/login`. Se `framework` è `unknown`
  è stato pubblicato il prototipo per errore.
- Emergenza: pubblicazione manuale con `deploy-site` del connettore Netlify da un pacchetto con `apps/web` + `packages/engine` + `netlify.toml`
  (`git archive HEAD apps/web packages/engine`); il comando restituito contiene un token che scade dopo poco: richiederne uno nuovo.
- Regione funzioni impostata dalla UI: Netlify → progetto → **Cloud compute → Functions → Region** = EU (Frankfurt). Milano solo tramite supporto.
- I due siti del prototipo si ripubblicano con `npx netlify deploy --prod --no-build --dir . --site <id>`.
- Supabase Auth → URL Configuration: Site URL = indirizzo Netlify; Redirect URLs = `https://segnali-uscita-app.netlify.app/**`, `http://localhost:3000/**`.
- Email di Supabase: il servizio gratuito ne manda pochissime all'ora. Per la demo si può disattivare «Confirm email» (Authentication → Sign In / Providers → Email):
  `signUp` gestisce entrambi i casi. Per la produzione serve un SMTP proprio.
- Su GitHub compare un check «Supabase Preview» fallito (integrazione GitHub ↔ Supabase/branching): non blocca nulla, si può scollegare.
- Vercel scartato: piano Hobby non commerciale e connettore senza accesso allo spazio progetti.

## Comandi
```bash
cd packages/engine && npm test && npm run typecheck   # 202 test (incluso confronto con i punteggi del prototipo)
cd packages/db && npm test                            # 26 test di sicurezza RLS
cd apps/web && npm run dev                            # http://localhost:3000 (serve .env.local, vedi .env.example)
cd apps/web && npm test && npx tsc --noEmit && npx eslint && npm run build   # 28 test
docs/make-guida.sh                                    # rigenera la guida PDF
```
CI GitHub Actions: `.github/workflows/{engine,db,web}.yml` (tutto deve restare verde) e `normativa.yml` (ogni lunedì, attivo su `main`).

## Supabase
- Progetto di sviluppo: `ncsxhdfdiotcrkszkevn` (Francoforte, piano Free, **solo dati inventati**). Produzione: da creare (piano Pro, DPA firmato).
- Sul Mac di Luca non ci sono Docker/psql e il login della CLI dal pulsante Run non funziona: **le migrazioni si applicano incollandole nell'SQL Editor** (copiare con `LANG=en_US.UTF-8 pbcopy < file`, altrimenti gli accenti si rovinano). Lo storico migrazioni della CLI non è allineato (da sistemare con `supabase migration repair`).
- Ogni nuova migrazione: file nuovo in `supabase/migrations` (mai modificare una già applicata) + test in `packages/db/test`.

## Regole non negoziabili (sicurezza e normativa)
1. **Separazione tra aziende nel database**: ogni tabella ha `org_id` e RLS; l'app usa solo la chiave pubblica e la sessione dell'utente.
2. **Ruoli** (`app_role`, più ruoli per persona): `admin`, `hr`, `hr_rischio`, `revisore`, `lettore`. Helper in `src/lib/supabase/server.ts` (`canSeePay`, `canRisk`, `isAdmin`).
3. **Rischio individuale**: nessuna lettura diretta di `risk_assessments`. Si apre solo con `open_risk(worker, motivazione)` (ruolo `hr_rischio`, motivazione ≥ 10 caratteri, accesso registrato in `risk_access_log`). La lista Segnali (`risk_list`) mostra **solo nomi e priorità, mai il punteggio**. Gli aggregati (`risk_overview`, `risk_groups`) nascondono i gruppi sotto 5 persone.
4. **Registri a sola aggiunta**: `audit_log` e `risk_access_log` non si modificano né si cancellano; i `pay_reports` definitivi sono immutabili (onere della prova, art. 18 Dir. 2023/970).
5. **Ricaricare l'Excel non deve perdere casi e valutazioni**: `import_period()` aggiorna le persone (upsert) in un'unica transazione.
6. **Nessun numero inventato** in calcoli, medie di mercato o testi normativi: ogni valore ha fonte e anno; ciò che è incerto si segnala come "da verificare".
7. Dati di esempio solo inventati (`demo.json`), mai dati reali nel repo.

## Metodo di calcolo (motore)
- **Divario** (D.Lgs. 96/2026 artt. 3, 9, 10): calcolato sul **livello retributivo** = retribuzione lorda oraria dei soli elementi **fissi e continuativi** (`basePay` ÷ ore), esclusi i trattamenti individuali non strutturali. Il variabile (`variablePay`) ha indicatori propri (lett. b, d, e); la retribuzione complessiva è solo informativa (`gapTotalMean`). (M − F) ÷ M; categorie dal campo `category` (di norma il livello CCNL, art. 4); celle sotto 3 persone per genere non pubblicate; soglia 5% (art. 10) in entrambe le direzioni. `ENGINE_VERSION` 0.2.0.
- **Rischio di uscita**: 9 driver a regole fisse definite da persone (non è un modello che apprende: se lo diventasse ricade nell'AI Act, All. III p. 4). Il confronto con il mercato usa la retribuzione di **base** oraria vs RAL di mercato ÷ 1.730 h. Ogni modifica ai pesi = nuova versione del modello.
- Controllo di equità del punteggio per genere (regola dei 4/5): sui dati demo le donne risultano "rischio alto" 2,5 volte più degli uomini, in parte per effetto del divario stesso. Da documentare nella DPIA.
- `ENGINE_VERSION` in `packages/engine/src/index.ts`: aggiornarla a ogni modifica dei calcoli (finisce nei report salvati).

## Pagina Normativa (`/normativa`)
Contenuto in `apps/web/src/lib/normativa.ts`, scritto sul testo integrale del D.Lgs. 96/2026 (ogni punto con l'articolo).
**Si aggiorna solo se cambia la norma**: `.github/workflows/normativa.yml` (ogni lunedì, attivo quando il workflow è sul ramo principale) lancia
`scripts/check-normativa.mjs`, che confronta il testo vigente su Normattiva (Akoma Ntoso) e le modifiche/rettifiche della Direttiva (SPARQL Ufficio pubblicazioni UE)
con le impronte in `normativa-watch.json`. Se cambiano: la pagina mostra «norma in verifica» e si apre una issue. Dopo la revisione umana del testo:
aggiornare `VERIFIED_ON` e lanciare `node scripts/check-normativa.mjs --accept`. Mai riscrivere il testo legale in automatico.
`test/normativa.test.ts` tiene allineati parametri della pagina e motore (soglia 5%, 100/150/250 dipendenti, scadenze).

## Piano d'azione (`/periodi/[id]/piano`)
Regole in `apps/web/src/lib/actionPlan.ts` (funzione pura, testata in `test/actionPlan.test.ts`): dai dati del periodo (divario per categoria, variabile,
quartili, obbligo di comunicazione, rischio aggregato, mercato) e dagli obblighi del D.Lgs. 96/2026 genera azioni con **chiave stabile**, priorità
(Critica/Alta/Media/Bassa), scadenza e orizzonte temporale. Lo stato deciso dalle persone (stato, responsabile, scadenza, note) sta in `action_items`
(migrazione `20260925180000_piano_azione.sql`). Esportazione Word/PDF: `documenti/piano`. Mai inserire nomi di persone nelle azioni di rischio: solo conteggi.

## Medie di mercato (`/mercato`)
Fonti: Eurostat SES 2022 (API), ISTAT Struttura delle retribuzioni 2022, INPS Osservatorio 2024 (non a tempo pieno), minimi CCNL Metalmeccanici (dal 1/6/2026) e Terziario Confcommercio (paga base dal 1/11/2026, esclusa contingenza). JobPricing escluso: dati di stampa incoerenti.
Aggiornare con `node scripts/make-benchmarks.mjs` e verificare i valori trascritti a mano sui documenti ufficiali.

## Documentazione per gli utenti
- **`/guida`** (pubblica, senza login, link dalla pagina di accesso): guida rapida e parametri di accesso per chi prova la demo.
- **`docs/Guida_Segnali_d_uscita.pdf`**: guida completa (10 pagine A4) generata da `docs/guida.html`.
- Quando cambiano schermate, pulsanti, colonne Excel, ruoli o parametri di legge: aggiornare **entrambe** (e rigenerare il PDF). I nomi dei pulsanti
  nelle guide devono essere identici a quelli dell'interfaccia.
- Demo: ogni tester crea il proprio account e la propria azienda (dati isolati), attiva il ruolo HR rischio da Impostazioni e carica l'esempio inventato.

## Stile del codice e dell'interfaccia
- Interfaccia e messaggi **in italiano semplice**; nomi di codice in inglese o italiano come nel file circostante.
- Server Components + Server Actions con `redirect(?e=…|?m=…)` per i messaggi; componenti client solo dove serve interattività (`EvalForm`, `ThemeToggle`, `PeriodTabs`).
- Colori solo tramite variabili CSS (`--brand #714b67`, `--hi`, `--mid`, `--lo`…) in `globals.css`; tema chiaro/scuro con `data-theme`.
- Commenti brevi che spiegano il perché (spesso il riferimento normativo).

## Decisioni prese con Luca
- Clienti: tante aziende (SaaS), di tutte le dimensioni. Dati da Excel e da gestionali, primo **Zucchetti** (in attesa di un export di esempio).
- Rischio individuale: solo HR rischio, con motivazione per **ogni singola persona**; il lavoratore va informato.
- Fattori di rischio: foglio Excel «Fattori rischio» + modifica manuale in Valutazione.
- Documenti: .doc da HTML e PDF da stampa come nel prototipo; .docx vero e archivio firmati in seguito.
- Server in UE (Francoforte). Esiste un DPO/consulente: preparargli DPIA e informativa.
- Hosting: **Netlify** (team Pro, uso commerciale consentito), aggiornamento automatico da GitHub `main`.

## Prossimi passi aperti
Inviti ai colleghi via email con ruolo · recupero password · SMTP proprio per le email · progetto Supabase di **produzione** (Pro) e DPA con Supabase e Netlify
prima di dati reali · valutare repository privato · connettore Zucchetti ·
DPIA e informativa ai lavoratori · workflow D.Lgs. 96/2026 (richieste di informazioni art. 7 con scadenza 2 mesi, fasce negli annunci art. 5, valutazione congiunta art. 10, conferma dati con i rappresentanti art. 9 c. 2) · decreti attuativi attesi (art. 9 c. 4, art. 14 c. 5) ·
rapporto biennale D.Lgs. 198/2006 art. 46 · altri CCNL · .docx vero · valutare il fattore "Comportamento" con il DPO (Statuto dei Lavoratori art. 4 e 8).
