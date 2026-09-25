-- Segnali d'uscita — stato delle azioni del Piano d'azione.
-- Le azioni sono generate dall'app a partire dai dati; qui si salva solo ciò che decidono le persone
-- (stato, responsabile, scadenza diversa, note), legato a una chiave stabile dell'azione.

create table public.action_items (
  org_id uuid not null references public.organizations(id) on delete cascade,
  period_id uuid not null references public.periods(id) on delete cascade,
  key text not null check (length(key) between 1 and 200),
  status text not null default 'Da fare' check (status in ('Da fare', 'In corso', 'Fatto', 'Non applicabile')),
  owner text check (length(owner) <= 200),
  due_on date,
  note text check (length(note) <= 2000),
  updated_by uuid default auth.uid() references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (period_id, key)
);

alter table public.action_items enable row level security;
-- Il piano è per chi gestisce retribuzioni e rischio; i lettori vedono gli stati (nessun dato individuale contenuto qui)
create policy actions_select on public.action_items for select to authenticated using (public.is_member(org_id));
create policy actions_write on public.action_items for all to authenticated
  using (public.has_role(org_id, '{admin,hr,hr_rischio}')) with check (public.has_role(org_id, '{admin,hr,hr_rischio}'));

create trigger audit after insert or update or delete on public.action_items for each row execute function public.audit();
create trigger touch before update on public.action_items for each row execute function public.touch_updated_at();
