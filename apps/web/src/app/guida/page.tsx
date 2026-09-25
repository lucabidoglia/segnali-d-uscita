import Link from "next/link";

export const metadata = { title: "Guida demo · Segnali d'uscita", description: "Come provare Segnali d'uscita in 10 minuti, con dati inventati" };

const APP = "https://segnali-uscita-app.netlify.app";

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="card flex gap-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-lg font-bold text-brand-fg">{n}</div>
      <div className="space-y-2 text-sm leading-relaxed"><h2 className="text-base font-semibold">{title}</h2>{children}</div>
    </section>
  );
}

/** Guida pubblica (senza login) per chi prova la demo. Parla semplice: i tester non sono tecnici. */
export default function Guida() {
  return (
    <article className="mx-auto max-w-3xl space-y-5 print:max-w-none">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Segnali d&apos;uscita — guida per la prova</h1>
        <p className="text-mut">Equità retributiva tra donne e uomini (D.Lgs. 96/2026) e rischio che le persone lascino l&apos;azienda. Bastano 10 minuti.</p>
        <p className="rounded-md border border-mid px-3 py-2 text-sm text-mid"><b>Ambiente di prova:</b> usa solo dati <b>inventati</b>. Non caricare mai stipendi o nomi di persone reali.</p>
      </header>

      <section className="card">
        <h2 className="mb-2 font-semibold">Parametri di accesso</h2>
        <table className="tbl"><tbody>
          <tr><td className="w-44 text-mut">Indirizzo</td><td><a className="font-semibold text-brand underline" href={APP}>{APP.replace("https://", "")}</a></td></tr>
          <tr><td className="text-mut">Utente</td><td>la <b>tua email</b> (ognuno crea il proprio account)</td></tr>
          <tr><td className="text-mut">Password</td><td>la scegli tu, <b>almeno 10 caratteri</b></td></tr>
          <tr><td className="text-mut">Azienda di prova</td><td>la crei tu al primo accesso: vedi solo la tua, gli altri tester non la vedono</td></tr>
          <tr><td className="text-mut">Dati di esempio</td><td>file Excel con 180 persone inventate, da scaricare dentro l&apos;app</td></tr>
          <tr><td className="text-mut">Browser</td><td>Chrome, Safari, Edge o Firefox aggiornati, da computer</td></tr>
        </tbody></table>
      </section>

      <Step n={1} title="Crea il tuo account">
        <p>Apri l&apos;indirizzo, scrivi <b>email</b> e una <b>password</b> di almeno 10 caratteri e clicca <b>Crea account</b>.</p>
        <p>Se ti arriva un&apos;email di conferma (controlla anche lo spam), aprila <b>dallo stesso browser</b> e clicca il link. Altrimenti entri subito.</p>
      </Step>

      <Step n={2} title="Crea la tua azienda di prova">
        <p>Scrivi un nome inventato (es. «Azienda Demo Rossi») e clicca <b>Crea azienda</b>. Diventi amministratore.</p>
      </Step>

      <Step n={3} title="Attiva il ruolo «HR rischio»">
        <p>In alto clicca <b>Impostazioni</b> → «I tuoi ruoli» → <b>Attiva</b> accanto a <b>HR rischio</b>.</p>
        <p className="text-mut">Serve per vedere Segnali, Valutazione e Registro: nella realtà solo poche persone HR hanno questo ruolo.</p>
      </Step>

      <Step n={4} title="Crea un periodo e carica i dati di esempio">
        <p>Nella pagina principale clicca <b>Crea periodo</b> (vanno bene i valori proposti).</p>
        <p>Nel periodo, scheda <b>Dati &amp; report Direttiva</b>: clicca <b>esempio con dati inventati</b>, salva il file, poi <b>Scegli file</b> → il file appena scaricato → <b>Carica e controlla</b>.</p>
      </Step>

      <Step n={5} title="Esplora (in quest'ordine)">
        <ul className="list-disc space-y-1 pl-5">
          <li><b>Quadro</b>: i numeri principali dell&apos;azienda.</li>
          <li><b>Piano d&apos;azione</b>: cosa fare, con priorità e scadenze di legge. Prova a cambiare lo stato di un&apos;azione.</li>
          <li><b>Equità</b>: il divario donne/uomini, cliccando su area → funzione → persona.</li>
          <li><b>Segnali</b>: le persone con priorità. Clicca <b>Valuta</b> su una persona: ti chiede <b>il motivo</b> prima di mostrare il punteggio (è una tutela della privacy).</li>
          <li><b>Funzioni &amp; rischio</b> e <b>Mercato</b>: il confronto con le medie di mercato ufficiali.</li>
          <li><b>Documenti</b>: scarica in Word o PDF la relazione sul divario, il dossier parità o una scheda di formazione.</li>
          <li>In alto: <b>Normativa</b> (la legge in breve) e <b>Medie di mercato</b>.</li>
        </ul>
      </Step>

      <Step n={6} title="Dicci cosa ne pensi">
        <p>Annota cosa non è chiaro, cosa manca o cosa non funziona (con la pagina e, se puoi, uno screenshot) e mandalo a chi ti ha invitato.</p>
      </Step>

      <section className="card space-y-2 text-sm">
        <h2 className="font-semibold">Se qualcosa non va</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li><b>Il link dell&apos;email non funziona</b>: aprilo nello stesso browser in cui ti sei registrato, oppure torna al sito e fai <b>Accedi</b>.</li>
          <li><b>«Troppe registrazioni in poco tempo»</b>: riprova tra qualche minuto.</li>
          <li><b>Non vedo Segnali o Valutazione</b>: attiva il ruolo HR rischio (passo 3).</li>
          <li><b>Il file viene scartato</b>: usa il file di esempio scaricato dall&apos;app, senza modificarne le colonne.</li>
          <li><b>Password dimenticata</b>: per ora crea un nuovo account con un&apos;altra email.</li>
        </ul>
      </section>

      <p className="text-center text-sm print:hidden"><Link className="btn" href="/login">Vai all&apos;app</Link></p>
    </article>
  );
}
