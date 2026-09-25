import { redirect } from "next/navigation";
import { dtIt } from "@/lib/format";
import { session } from "@/lib/supabase/server";

/** Per revisore (DPO) e amministratore: chi ha aperto il rischio di chi, con quale motivo; e le modifiche ai dati. */
export default async function Audit() {
  const { sb, membership } = await session();
  if (!membership || !membership.roles.some(r => r === "admin" || r === "revisore")) redirect("/");
  const { data: access } = await sb.from("risk_access_log").select("accessed_at, user_id, reason, worker_id").order("accessed_at", { ascending: false }).limit(200);
  const { data: log } = await sb.from("audit_log").select("at, user_id, table_name, action, row_id").order("at", { ascending: false }).limit(200);
  const short = (u: string | null) => (u ? u.slice(0, 8) : "sistema");
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Registri di controllo</h1>
      <p className="note">Ultime 200 righe. Questi registri non si possono modificare né cancellare, nemmeno dall&apos;amministratore. Gli utenti sono indicati con il loro codice.</p>
      <div className="card overflow-x-auto p-0">
        <h2 className="px-5 pt-4 font-semibold">Accessi al rischio individuale</h2>
        <table className="tbl mt-2"><thead><tr><th>Quando</th><th>Utente</th><th>Persona (codice)</th><th>Motivazione</th></tr></thead>
          <tbody>{(access ?? []).map((a, i) => <tr key={i}><td>{dtIt(a.accessed_at)}</td><td className="font-mono text-xs">{short(a.user_id)}</td><td className="font-mono text-xs">{short(a.worker_id)}</td><td>{a.reason}</td></tr>)}</tbody></table>
      </div>
      <div className="card overflow-x-auto p-0">
        <h2 className="px-5 pt-4 font-semibold">Registro attività</h2>
        <table className="tbl mt-2"><thead><tr><th>Quando</th><th>Utente</th><th>Tabella</th><th>Azione</th></tr></thead>
          <tbody>{(log ?? []).map((a, i) => <tr key={i}><td>{dtIt(a.at)}</td><td className="font-mono text-xs">{short(a.user_id)}</td><td>{a.table_name}</td><td>{a.action}</td></tr>)}</tbody></table>
      </div>
    </div>
  );
}
