import { redirect } from "next/navigation";
import { loadSettings, SETTINGS_FIELDS } from "@/lib/settings";
import { canSeePay, isAdmin, session, type Role } from "@/lib/supabase/server";
import { saveSettings, toggleMyRole } from "./actions";

const ROLES: [Role, string, string][] = [
  ["admin", "Amministratore", "Gestisce utenti e impostazioni"],
  ["hr", "HR", "Carica i dati, vede le retribuzioni, produce report e documenti"],
  ["hr_rischio", "HR rischio", "Come HR, in più vede Segnali, Valutazione e Registro; il rischio di una persona si apre solo con una motivazione"],
  ["revisore", "Revisore (DPO)", "Legge il registro attività e gli accessi al rischio, non gli stipendi"],
  ["lettore", "Lettore", "Vede solo dati aggregati"],
];

export default async function Impostazioni({ searchParams }: PageProps<"/impostazioni">) {
  const { e, m } = await searchParams;
  const { sb, membership } = await session();
  if (!membership) redirect("/");
  const s = await loadSettings(sb, membership.org_id, membership.orgName);
  const pay = canSeePay(membership), admin = isAdmin(membership);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Impostazioni</h1>
      {e && <p className="rounded-md border border-hi px-3 py-2 text-sm text-hi">{e}</p>}
      {m && <p className="rounded-md border border-lo px-3 py-2 text-sm text-lo">{m}</p>}

      {admin && (
        <div className="card space-y-3">
          <h2 className="font-semibold">I tuoi ruoli</h2>
          <p className="text-sm text-mut">Una persona può avere più ruoli. Ogni modifica resta nel registro attività, consultabile dal revisore.</p>
          <div className="divide-y divide-line">
            {ROLES.map(([r, label, help]) => {
              const on = membership.roles.includes(r);
              return (
                <div key={r} className="flex items-center gap-4 py-2">
                  <div className="grow"><div className="font-medium">{label}</div><div className="text-xs text-mut">{help}</div></div>
                  {r === "admin" ? <span className="text-xs text-mut">attivo</span> : (
                    <form action={toggleMyRole.bind(null, r)}><button className={on ? "btn" : "btn-sec"}>{on ? "Attivo · disattiva" : "Attiva"}</button></form>
                  )}
                </div>
              );
            })}
          </div>
          <p className="note">Prossimo passo: invito dei colleghi via email con il ruolo scelto.</p>
        </div>
      )}

      {pay && (
        <form action={saveSettings} className="card space-y-4">
          <div>
            <h2 className="font-semibold">Dati azienda e fondo</h2>
            <p className="text-sm text-mut">Compaiono nell&apos;intestazione e nei calcoli dei documenti. Le aliquote servono a scomporre il costo del lavoro nella scheda di formazione.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SETTINGS_FIELDS.map(([k, label, t]) => (
              <div key={k}><label className="label" htmlFor={k}>{label}</label>
                <input className="input" id={k} name={k} type="text" inputMode={t === "number" ? "decimal" : undefined} defaultValue={String(s[k]).replace(".", t === "number" ? "," : ".")} /></div>
            ))}
          </div>
          <button className="btn">Salva</button>
        </form>
      )}
    </div>
  );
}
