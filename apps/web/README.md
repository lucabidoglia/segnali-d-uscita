# Segnali d'uscita — app web (Next.js 16 + Supabase)

Prima versione multi-azienda: accesso con email, creazione dell'azienda, periodi, import Excel con controlli riga per riga,
report sul divario retributivo (Dir. UE 2023/970, art. 9) calcolato da `@g1g10/engine`, report salvabili e resi definitivi (immutabili).

```bash
cp .env.example .env.local   # URL e chiave PUBBLICA del progetto Supabase
npm install
npm run dev                  # http://localhost:3000
npm test                     # test dell'import Excel
node scripts/make-demo.mjs   # rigenera src/lib/demo-rows.json dai dati inventati del prototipo
```

Sicurezza: l'app usa solo la chiave pubblica; ciò che ogni utente vede è deciso dalle regole RLS in `supabase/migrations`.
Leggere `AGENTS.md` prima di modificare il codice (Next.js 16 ha convenzioni diverse, es. `src/proxy.ts` al posto del middleware).
