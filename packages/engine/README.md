# @g1g10/engine

Motore di calcolo di Segnali d'uscita, indipendente dall'interfaccia: sarà usato dalla nuova app (server) e dai connettori di import.

| Modulo | Cosa fa |
|---|---|
| `types.ts` | Modello dati canonico del lavoratore: il formato unico in cui confluiscono Excel e gestionali (Zucchetti, …) |
| `payGap.ts` | Indicatori art. 9 lett. a–g della Direttiva (UE) 2023/970 sulla **retribuzione lorda oraria** (base + variabile), soglia 5% per la valutazione congiunta (art. 10), obbligo di comunicazione per dimensione |
| `risk.ts` | Rischio di uscita (porta 1:1 del prototipo v1.3.0) con modello **versionato**, più controllo di equità per genere (regola dei 4/5) |
| `validate.ts` | Controlli di qualità sui dati importati |

```bash
npm install
npm test          # 201 test, incluso il confronto con i punteggi del prototipo v1.3.0
npm run golden    # rigenera il riferimento dal prototipo (solo se il prototipo cambia di proposito)
```

Scelte di metodo da confermare con il decreto italiano di recepimento: vedi l'intestazione di `src/payGap.ts`.
