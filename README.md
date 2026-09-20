# Segnali d'uscita · G1G10

App statica (HTML + CSS + JS, nessun framework, nessun build) della suite **G1G10** per leggere il rischio di uscita delle persone, l'equità retributiva e le priorità di intervento.

> **Dati dimostrativi.** Azienda industriale fittizia (uffici staff, produzione, logistica), nomi, matricole e retribuzioni sono inventati e generati in modo deterministico da [tools/gen-data.mjs](tools/gen-data.mjs). Nessun dato reale è incluso.

## Sezioni

| Sezione | Cosa fa |
|---|---|
| Quadro | KPI, distribuzione del rischio, rischio per struttura, priorità critiche |
| Segnali | Lista in stile Odoo: filtri per sede/livello/stato, selezione multipla, Apri caso · Monitora · Rinvia, export CSV |
| Valutazione | Motore di rischio a 9 driver (0–100), priorità, costo a rischio vs costo dell'intervento |
| Funzioni & rischio | Rischio e scostamento dal mercato, con drill-down area → funzione → singola persona (fattori a rischio) |
| Equità | Divario retributivo donne/uomini, soglia 5%, con drill-down area → funzione → singola persona |
| Documenti | Generazione automatica di documenti in Word (.doc) e PDF (stampa): **scheda individuale di formazione finanziata** (costo orario = costo annuo ÷ 1.720 h × FTE), **relazione sul divario retributivo** (Dir. UE 2023/970: divario medio e mediano, quartili, categorie ≥ 5%) e **dossier parità di genere** (UNI/PdR 125:2022, 6 aree). Fascicolo di tutte le schede per area. Dati azienda e fondo modificabili |
| Registro | Casi salvati, stato, export CSV (salvati nel browser) |

Tema **chiaro o scuro** dal pulsante in alto a destra (segue il sistema al primo avvio, poi ricorda la scelta).

## Avvio

```bash
python3 -m http.server 8765   # poi apri http://localhost:8765
node tools/gen-data.mjs       # rigenera js/data.js (facoltativo)
```

## Versione

`VERSION` in [js/app.js](js/app.js), mostrata nel piè di pagina ("Powered by G1G10 · v…"). Aggiornarla a ogni rilascio.

## Deploy

Sito statico, `netlify.toml` pubblica la radice del repository.
