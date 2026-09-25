-- Segnali d'uscita — permessi sulle funzioni (avvisi del Security Advisor di Supabase, lint 0028/0029).
-- In Postgres/Supabase le funzioni nuove sono eseguibili da tutti per impostazione predefinita: qui si chiude.

-- 1. audit(): è una funzione di trigger. I trigger funzionano senza il permesso EXECUTE di chi modifica i dati,
--    quindi nessuno deve poterla chiamare direttamente via /rest/v1/rpc/audit.
revoke execute on function public.audit() from public, anon, authenticated;

-- 2. has_role() e is_member(): usate dalle regole RLS (valutate come utente collegato), quindi servono ad `authenticated`;
--    agli anonimi non servono (non hanno accesso ad alcuna tabella).
revoke execute on function public.has_role(uuid, public.app_role[]) from public, anon;
revoke execute on function public.is_member(uuid) from public, anon;
grant execute on function public.has_role(uuid, public.app_role[]) to authenticated;
grant execute on function public.is_member(uuid) to authenticated;

-- 3. Anche le altre funzioni, per sicurezza, mai eseguibili da anonimi
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
revoke execute on function public.pay_report_immutable() from public, anon, authenticated;

-- 4. D'ora in poi le funzioni nuove NON sono eseguibili da nessuno finché non si concede il permesso esplicitamente.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- Restano volutamente eseguibili dagli utenti collegati (ognuna controlla internamente ruolo, azienda e motivazione):
-- create_organization, open_risk, risk_list, risk_groups, risk_overview, risk_summary, import_period.
