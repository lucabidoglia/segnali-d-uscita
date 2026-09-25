-- Segnali d'uscita — fondamenta multi-azienda.
-- Principi:
--  1. Ogni riga appartiene a un'azienda (org_id) e la separazione è imposta dal database (Row Level Security),
--     non solo dall'applicazione.
--  2. Il punteggio di rischio individuale NON è leggibile direttamente: si apre solo con la funzione
--     open_risk(), che richiede ruolo hr_rischio e una motivazione, e registra l'accesso.
--  3. Registro attività e report definitivi sono a sola aggiunta: non si modificano né si cancellano.

-- ---------------------------------------------------------------- ruoli
create type public.app_role as enum (
  'admin',       -- gestisce utenti e impostazioni dell'azienda
  'hr',          -- carica dati, produce report sul divario (vede retribuzioni individuali)
  'hr_rischio',  -- come hr + può aprire il rischio individuale, con motivazione
  'revisore',    -- DPO / audit: legge registro attività e accessi, non i dati retributivi individuali
  'lettore'      -- vede solo report aggregati
);

-- ---------------------------------------------------------------- aziende e utenti
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  vat_number text,
  created_at timestamptz not null default now()
);

create table public.memberships (
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index on public.memberships (user_id);

-- Vero se l'utente collegato ha uno dei ruoli indicati nell'azienda.
-- security definer: legge memberships senza ricadere nelle sue stesse policy.
create function public.has_role(p_org uuid, p_roles public.app_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org and m.user_id = (select auth.uid()) and m.role = any (p_roles)
  );
$$;

create function public.is_member(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.memberships m where m.org_id = p_org and m.user_id = (select auth.uid()));
$$;

-- Crea un'azienda e rende admin chi la crea.
create function public.create_organization(p_name text, p_vat text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Accesso richiesto'; end if;
  insert into public.organizations (name, vat_number) values (p_name, p_vat) returning id into v_id;
  insert into public.memberships (org_id, user_id, role) values (v_id, (select auth.uid()), 'admin');
  return v_id;
end $$;

-- ---------------------------------------------------------------- periodi e import
create table public.periods (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  label text not null,
  starts_on date not null,
  ends_on date not null check (ends_on >= starts_on),
  created_at timestamptz not null default now(),
  unique (org_id, label)
);

create table public.imports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  period_id uuid not null references public.periods(id) on delete cascade,
  source text not null check (source in ('excel', 'zucchetti')),
  file_name text,
  row_count int not null default 0,
  issues jsonb not null default '[]',
  created_by uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

-- Lavoratore nel periodo: stesso formato di packages/engine/src/types.ts
create table public.workers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  period_id uuid not null references public.periods(id) on delete cascade,
  import_id uuid references public.imports(id) on delete set null,
  employee_code text not null,               -- matricola
  full_name text,                            -- facoltativo: non serve al calcolo del divario (minimizzazione)
  gender text not null check (gender in ('F', 'M', 'ND')),
  category text not null,                    -- categoria di pari valore (art. 4 Dir. 2023/970)
  funzione text not null,
  mansione text, sede text, area text, livello text,
  fte numeric(4,3) not null check (fte > 0 and fte <= 1),
  hours_paid numeric(8,2) not null check (hours_paid >= 0),
  base_pay numeric(12,2) not null check (base_pay >= 0),
  variable_pay numeric(12,2) not null default 0 check (variable_pay >= 0),
  employer_cost numeric(12,2),
  seniority_years numeric(4,1),
  unique (org_id, period_id, employee_code)
);
create index on public.workers (org_id, period_id);

-- ---------------------------------------------------------------- rischio di uscita
create table public.risk_assessments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  worker_id uuid not null references public.workers(id) on delete cascade,
  model_version text not null,
  factors jsonb not null,
  score smallint not null check (score between 0 and 100),
  level text not null check (level in ('Alto', 'Medio', 'Basso')),
  priority text not null check (priority in ('Critica', 'Alta', 'Media', 'Bassa')),
  drivers jsonb not null default '[]',
  created_by uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);
create index on public.risk_assessments (org_id, worker_id, created_at desc);

create table public.risk_access_log (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  worker_id uuid not null references public.workers(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  reason text not null check (length(trim(reason)) >= 10),
  accessed_at timestamptz not null default now()
);

-- Unica via per leggere il rischio di una persona: controlla il ruolo, pretende una motivazione, registra.
create function public.open_risk(p_worker uuid, p_reason text)
returns setof public.risk_assessments language plpgsql security definer set search_path = '' as $$
declare v_org uuid;
begin
  select org_id into v_org from public.workers where id = p_worker;
  if v_org is null or not public.has_role(v_org, array['hr_rischio']::public.app_role[]) then
    raise exception 'Non autorizzato a vedere il rischio individuale';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 10 then
    raise exception 'Serve una motivazione di almeno 10 caratteri';
  end if;
  insert into public.risk_access_log (org_id, worker_id, user_id, reason) values (v_org, p_worker, (select auth.uid()), trim(p_reason));
  return query select * from public.risk_assessments where worker_id = p_worker order by created_at desc limit 1;
end $$;

-- Rischio aggregato per funzione, senza nomi. Gruppi sotto p_min_cell persone non vengono mostrati.
create function public.risk_summary(p_period uuid, p_min_cell int default 5)
returns table (funzione text, persone bigint, rischio_medio numeric, quota_alto numeric)
language plpgsql stable security definer set search_path = '' as $$
declare v_org uuid;
begin
  select org_id into v_org from public.periods where id = p_period;
  if v_org is null or not public.is_member(v_org) then raise exception 'Non autorizzato'; end if;
  return query
    with last as (
      select distinct on (r.worker_id) r.worker_id, r.score, r.level
      from public.risk_assessments r join public.workers w on w.id = r.worker_id
      where w.period_id = p_period order by r.worker_id, r.created_at desc
    )
    select w.funzione, count(*), round(avg(l.score), 1), round(100.0 * count(*) filter (where l.level = 'Alto') / count(*), 1)
    from last l join public.workers w on w.id = l.worker_id
    group by w.funzione having count(*) >= greatest(p_min_cell, 3) order by 3 desc;
end $$;

create table public.cases (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  worker_id uuid not null references public.workers(id) on delete cascade,
  status text not null default 'Aperto' check (status in ('Aperto', 'In corso', 'Chiuso')),
  priority text not null,
  note text,
  created_by uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- report sul divario (Dir. 2023/970)
create table public.pay_reports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  period_id uuid not null references public.periods(id) on delete restrict,
  engine_version text not null,
  payload jsonb not null,                    -- output di payGapReport()
  finalized_at timestamptz,
  created_by uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

-- Un report definitivo è una prova (onere della prova, art. 18): non si modifica né si cancella.
create function public.pay_report_immutable() returns trigger language plpgsql set search_path = '' as $$
begin
  if old.finalized_at is not null then raise exception 'Report definitivo: non modificabile'; end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
create trigger pay_report_immutable before update or delete on public.pay_reports
  for each row execute function public.pay_report_immutable();

-- ---------------------------------------------------------------- registro attività
create table public.audit_log (
  id bigint generated always as identity primary key,
  org_id uuid,
  user_id uuid,
  table_name text not null,
  action text not null,
  row_id text,
  at timestamptz not null default now()
);
create index on public.audit_log (org_id, at desc);

create function public.audit() returns trigger language plpgsql security definer set search_path = '' as $$
declare r jsonb := to_jsonb(coalesce(new, old));
begin
  insert into public.audit_log (org_id, user_id, table_name, action, row_id)
  values (coalesce((r->>'org_id')::uuid, (r->>'id')::uuid), (select auth.uid()), tg_table_name, tg_op, coalesce(r->>'id', r->>'user_id'));
  return null;
end $$;

do $$ declare t text;
begin
  foreach t in array array['organizations','memberships','periods','imports','workers','risk_assessments','cases','pay_reports'] loop
    execute format('create trigger audit after insert or update or delete on public.%I for each row execute function public.audit()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- Row Level Security
alter table public.organizations    enable row level security;
alter table public.memberships      enable row level security;
alter table public.periods          enable row level security;
alter table public.imports          enable row level security;
alter table public.workers          enable row level security;
alter table public.risk_assessments enable row level security;
alter table public.risk_access_log  enable row level security;
alter table public.cases            enable row level security;
alter table public.pay_reports      enable row level security;
alter table public.audit_log        enable row level security;

create policy org_select on public.organizations for select to authenticated using (public.is_member(id));
create policy org_update on public.organizations for update to authenticated using (public.has_role(id, '{admin}')) with check (public.has_role(id, '{admin}'));

create policy mem_select on public.memberships for select to authenticated using (user_id = (select auth.uid()) or public.has_role(org_id, '{admin}'));
create policy mem_admin on public.memberships for all to authenticated using (public.has_role(org_id, '{admin}')) with check (public.has_role(org_id, '{admin}'));

-- Dati retributivi individuali: solo admin e HR
do $$ declare t text;
begin
  foreach t in array array['periods','imports','workers'] loop
    execute format($f$create policy hr_all on public.%I for all to authenticated
      using (public.has_role(org_id, '{admin,hr,hr_rischio}')) with check (public.has_role(org_id, '{admin,hr,hr_rischio}'))$f$, t);
  end loop;
end $$;
-- Chiunque nell'azienda vede l'elenco dei periodi (serve ai report aggregati)
create policy periods_member_select on public.periods for select to authenticated using (public.is_member(org_id));

-- Rischio: si scrive (valutazioni), non si legge direttamente → open_risk() / risk_summary()
create policy risk_insert on public.risk_assessments for insert to authenticated with check (public.has_role(org_id, '{hr_rischio}'));
create policy cases_all on public.cases for all to authenticated using (public.has_role(org_id, '{hr_rischio}')) with check (public.has_role(org_id, '{hr_rischio}'));

create policy access_log_select on public.risk_access_log for select to authenticated using (public.has_role(org_id, '{admin,revisore}'));

create policy reports_select on public.pay_reports for select to authenticated using (public.is_member(org_id));
create policy reports_write on public.pay_reports for all to authenticated using (public.has_role(org_id, '{admin,hr,hr_rischio}')) with check (public.has_role(org_id, '{admin,hr,hr_rischio}'));

create policy audit_select on public.audit_log for select to authenticated using (public.has_role(org_id, '{admin,revisore}'));

-- Registri a sola aggiunta anche per chi aggira l'app con la chiave pubblica
revoke update, delete on public.audit_log, public.risk_access_log from anon, authenticated;
revoke insert on public.audit_log, public.risk_access_log from anon, authenticated;
revoke all on all tables in schema public from anon;
revoke execute on function public.create_organization(text, text), public.open_risk(uuid, text), public.risk_summary(uuid, int) from anon, public;
grant execute on function public.create_organization(text, text), public.open_risk(uuid, text), public.risk_summary(uuid, int) to authenticated;
