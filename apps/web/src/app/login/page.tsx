import { signIn, signUp } from "./actions";

export default async function Login({ searchParams }: PageProps<"/login">) {
  const { e, m } = await searchParams;
  return (
    <div className="mx-auto mt-10 max-w-sm">
      <div className="card space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Accedi</h1>
          <p className="text-sm text-mut">Equità retributiva e segnali d&apos;uscita</p>
        </div>
        {e && <p className="rounded-md border border-hi px-3 py-2 text-sm text-hi">{e}</p>}
        {m && <p className="rounded-md border border-lo px-3 py-2 text-sm text-lo">{m}</p>}
        <form className="space-y-3">
          <div><label className="label" htmlFor="email">Email</label><input className="input" id="email" name="email" type="email" required autoComplete="email" /></div>
          <div><label className="label" htmlFor="password">Password</label><input className="input" id="password" name="password" type="password" required minLength={10} autoComplete="current-password" /></div>
          <div className="flex gap-2">
            <button className="btn" formAction={signIn}>Accedi</button>
            <button className="btn-sec" formAction={signUp}>Crea account</button>
          </div>
          <p className="text-xs text-mut">Primo accesso? Scrivi email e una password di almeno 10 caratteri e premi «Crea account».</p>
        </form>
      </div>
    </div>
  );
}
