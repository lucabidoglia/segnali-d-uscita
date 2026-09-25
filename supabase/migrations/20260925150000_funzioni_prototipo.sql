-- Segnali d'uscita — funzioni del prototipo: impostazioni azienda, formazione, riferimenti di mercato,
-- monitora/rinvia, lista segnali senza punteggio, aggregati di rischio, import atomico.

-- ---------------------------------------------------------------- più ruoli per persona (es. admin + hr_rischio)
alter table public.memberships drop constraint memberships_pkey;
alter table public.memberships add primary key (org_id, user_id, role);

-- ---------------------------------------------------------------- impostazioni per documenti e calcoli
create table public.org_settings (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  data jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.org_settings enable row level security;
create policy settings_select on public.org_settings for select to authenticated using (public.is_member(org_id));
create policy settings_write on public.org_settings for all to authenticated
  using (public.has_role(org_id, '{admin,hr,hr_rischio}')) with check (public.has_role(org_id, '{admin,hr,hr_rischio}'));
create trigger audit after insert or update or delete on public.org_settings for each row execute function public.audit();

-- ---------------------------------------------------------------- formazione finanziata
alter table public.workers
  add column training_title text,
  add column training_hours numeric(6,1) check (training_hours >= 0),
  add column training_start date;

-- ---------------------------------------------------------------- riferimenti di mercato (RAL media per funzione e periodo)
create table public.market_refs (
  org_id uuid not null references public.organizations(id) on delete cascade,
  period_id uuid not null references public.periods(id) on delete cascade,
  funzione text not null,
  annual_pay numeric(12,2) not null check (annual_pay > 0),
  primary key (period_id, funzione)
);
alter table public.market_refs enable row level security;
create policy market_hr on public.market_refs for all to authenticated
  using (public.has_role(org_id, '{admin,hr,hr_rischio}')) with check (public.has_role(org_id, '{admin,hr,hr_rischio}'));

-- ---------------------------------------------------------------- monitora / rinvia
create table public.worker_flags (
  worker_id uuid primary key references public.workers(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  state text not null check (state in ('auto', 'snooze')),
  updated_at timestamptz not null default now()
);
alter table public.worker_flags enable row level security;
create policy flags_risk on public.worker_flags for all to authenticated
  using (public.has_role(org_id, '{hr_rischio}')) with check (public.has_role(org_id, '{hr_rischio}'));
create trigger audit after insert or update or delete on public.worker_flags for each row execute function public.audit();

-- ---------------------------------------------------------------- viste di supporto (solo per le funzioni sotto)
-- Retribuzione di base oraria, mercato orario (RAL ÷ 1.730 h) e costo a rischio (RAL annua stimata × 1,75 × punteggio)
create function public._risk_rows(p_period uuid)
returns table (worker_id uuid, area text, sede text, funzione text, hourly numeric, market_hourly numeric, score int, level text, priority text, cost_at_risk numeric)
language sql stable security definer set search_path = '' as $$
  select w.id, coalesce(w.area, '—'), coalesce(w.sede, '—'), w.funzione,
    case when w.hours_paid > 0 then w.base_pay / w.hours_paid end,  -- base oraria: confrontabile con la RAL di mercato
    m.annual_pay / 1730,
    r.score, r.level, r.priority,
    case when r.score is not null then
      (w.base_pay + w.variable_pay) * 365.0 / greatest(1, p.ends_on - p.starts_on + 1) * 1.75 * r.score / 100 end
  from public.workers w
  join public.periods p on p.id = w.period_id
  left join public.market_refs m on m.period_id = w.period_id and m.funzione = w.funzione
  left join lateral (select score, level, priority from public.risk_assessments ra where ra.worker_id = w.id order by created_at desc limit 1) r on true
  where w.period_id = p_period;
$$;
revoke execute on function public._risk_rows(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------- lista Segnali: nomi e priorità, MAI il punteggio
create function public.risk_list(p_period uuid)
returns table (worker_id uuid, employee_code text, full_name text, sede text, area text, funzione text, mansione text,
               seniority_years numeric, priority text, assessed boolean, flag text)
language plpgsql stable security definer set search_path = '' as $$
declare v_org uuid;
begin
  select org_id into v_org from public.periods where id = p_period;
  if v_org is null or not public.has_role(v_org, '{hr_rischio}') then raise exception 'Non autorizzato'; end if;
  return query
    select w.id, w.employee_code, w.full_name, w.sede, w.area, w.funzione, w.mansione, w.seniority_years,
      r.priority, r.priority is not null, f.state
    from public.workers w
    left join lateral (select ra.priority from public.risk_assessments ra where ra.worker_id = w.id order by ra.created_at desc limit 1) r on true
    left join public.worker_flags f on f.worker_id = w.id
    where w.period_id = p_period;
end $$;

-- ---------------------------------------------------------------- aggregati di rischio per tutti i membri (senza nomi)
-- Raggruppa per area (p_area null) oppure per funzione dentro un'area. Gruppi sotto p_min_cell: solo il numero di persone.
create function public.risk_groups(p_period uuid, p_area text default null, p_min_cell int default 5)
returns table (grp text, persone bigint, valutate bigint, visibile boolean, rischio_medio numeric, rischio_alto bigint, critiche bigint,
               orario_medio numeric, mercato_orario numeric, costo_a_rischio numeric)
language plpgsql stable security definer set search_path = '' as $$
declare v_org uuid;
begin
  select org_id into v_org from public.periods where id = p_period;
  if v_org is null or not public.is_member(v_org) then raise exception 'Non autorizzato'; end if;
  return query
    with g as (
      select case when p_area is null then x.area else x.funzione end as k, x.*
      from public._risk_rows(p_period) x where p_area is null or x.area = p_area
    )
    select g.k, count(*), count(g.score), count(*) >= greatest(p_min_cell, 3),
      case when count(*) >= greatest(p_min_cell, 3) then round(avg(g.score), 1) end,
      case when count(*) >= greatest(p_min_cell, 3) then count(*) filter (where g.level = 'Alto') end,
      case when count(*) >= greatest(p_min_cell, 3) then count(*) filter (where g.priority = 'Critica') end,
      case when count(*) >= greatest(p_min_cell, 3) then round(avg(g.hourly), 2) end,
      case when count(*) >= greatest(p_min_cell, 3) then round(avg(g.market_hourly), 2) end,
      case when count(*) >= greatest(p_min_cell, 3) then round(sum(g.cost_at_risk), 0) end
    from g group by g.k order by 5 desc nulls last, 1;
end $$;

-- Quadro: distribuzione in 10 fasce, totali, rischio per sede
create function public.risk_overview(p_period uuid, p_min_cell int default 5)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_org uuid; v jsonb;
begin
  select org_id into v_org from public.periods where id = p_period;
  if v_org is null or not public.is_member(v_org) then raise exception 'Non autorizzato'; end if;
  with x as (select * from public._risk_rows(p_period))
  select jsonb_build_object(
    'persone', (select count(*) from x),
    'valutate', (select count(score) from x),
    'rischio_medio', (select round(avg(score), 1) from x),
    'rischio_alto', (select count(*) from x where level = 'Alto'),
    'critiche', (select count(*) from x where priority = 'Critica'),
    'costo_a_rischio', (select round(coalesce(sum(cost_at_risk), 0), 0) from x),
    'fasce', (select jsonb_agg(c order by b) from (
        select b, (select count(*) from x where score is not null and least(9, x.score / 10) = b) c from generate_series(0, 9) b) f),
    'per_sede', (select coalesce(jsonb_agg(jsonb_build_object('sede', sede, 'persone', n, 'rischio_medio', a) order by a desc), '[]') from (
        select sede, count(*) n, round(avg(score), 1) a from x where score is not null group by sede having count(*) >= greatest(p_min_cell, 3)) s)
  ) into v;
  return v;
end $$;

revoke execute on function public.risk_list(uuid), public.risk_groups(uuid, text, int), public.risk_overview(uuid, int) from public, anon;
grant execute on function public.risk_list(uuid), public.risk_groups(uuid, text, int), public.risk_overview(uuid, int) to authenticated;

-- ---------------------------------------------------------------- import atomico
-- Tutto o niente. Le persone già presenti vengono AGGIORNATE (restano casi e valutazioni); quelle non più nel file vengono tolte.
-- security invoker: valgono le regole RLS di chi importa.
create function public.import_period(p_period uuid, p_file_name text, p_issues jsonb, p_workers jsonb, p_market jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_org uuid; v_imp uuid;
begin
  select org_id into v_org from public.periods where id = p_period;
  if v_org is null or not public.has_role(v_org, '{admin,hr,hr_rischio}') then raise exception 'Non autorizzato'; end if;

  insert into public.imports (org_id, period_id, source, file_name, row_count, issues)
  values (v_org, p_period, 'excel', p_file_name, jsonb_array_length(p_workers), coalesce(p_issues, '[]')) returning id into v_imp;

  insert into public.workers as t (org_id, period_id, import_id, employee_code, full_name, gender, category, funzione, mansione, sede, area, livello,
    fte, hours_paid, base_pay, variable_pay, employer_cost, seniority_years, training_title, training_hours, training_start)
  select v_org, p_period, v_imp, x.employee_code, x.full_name, x.gender, x.category, x.funzione, x.mansione, x.sede, x.area, x.livello,
    x.fte, x.hours_paid, x.base_pay, coalesce(x.variable_pay, 0), x.employer_cost, x.seniority_years, x.training_title, x.training_hours, x.training_start
  from jsonb_to_recordset(p_workers) as x(employee_code text, full_name text, gender text, category text, funzione text, mansione text, sede text,
    area text, livello text, fte numeric, hours_paid numeric, base_pay numeric, variable_pay numeric, employer_cost numeric, seniority_years numeric,
    training_title text, training_hours numeric, training_start date)
  on conflict (org_id, period_id, employee_code) do update set
    import_id = excluded.import_id, full_name = excluded.full_name, gender = excluded.gender, category = excluded.category, funzione = excluded.funzione,
    mansione = excluded.mansione, sede = excluded.sede, area = excluded.area, livello = excluded.livello, fte = excluded.fte,
    hours_paid = excluded.hours_paid, base_pay = excluded.base_pay, variable_pay = excluded.variable_pay, employer_cost = excluded.employer_cost,
    seniority_years = excluded.seniority_years, training_title = excluded.training_title, training_hours = excluded.training_hours,
    training_start = excluded.training_start;

  delete from public.workers where period_id = p_period and import_id is distinct from v_imp;

  if p_market is not null and jsonb_array_length(p_market) > 0 then
    delete from public.market_refs where period_id = p_period;
    insert into public.market_refs (org_id, period_id, funzione, annual_pay)
    select v_org, p_period, m.funzione, m.annual_pay from jsonb_to_recordset(p_market) as m(funzione text, annual_pay numeric);
  end if;
  return v_imp;
end $$;
revoke execute on function public.import_period(uuid, text, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.import_period(uuid, text, jsonb, jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------- casi: data di aggiornamento
create function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;
create trigger touch before update on public.cases for each row execute function public.touch_updated_at();
