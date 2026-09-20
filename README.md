# Segnali d'uscita · G1G10

App statica (HTML + CSS + JS, nessun framework, nessun build) della suite **G1G10** per leggere il rischio di uscita delle persone, l'equità retributiva e le priorità di intervento.

> **Dati dimostrativi.** Organizzazione, nomi, matricole e retribuzioni sono inventati e generati in modo deterministico da [tools/gen-data.mjs](tools/gen-data.mjs). Nessun dato reale è incluso.

## Sezioni

| Sezione | Cosa fa |
|---|---|
| Quadro | KPI, distribuzione del rischio, rischio per struttura, priorità critiche |
| Segnali | Lista in stile Odoo: filtri per sede/livello/stato, selezione multipla, Apri caso · Monitora · Rinvia, export CSV |
| Valutazione | Motore di rischio a 9 driver (0–100), priorità, costo a rischio vs costo dell'intervento |
| Funzioni & rischio | Rischio e scostamento dal mercato per funzione (4 bande) |
| Equità | Divario retributivo donne/uomini a parità di funzione, soglia 5% |
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
