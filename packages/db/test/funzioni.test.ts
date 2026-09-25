import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { as, freshDb, uid } from './harness.js';

const U = { admin: uid(11), hr: uid(12), read: uid(13), other: uid(14) };
let db: PGlite, org: string, period: string;

const people = (n: number, extra: Record<string, unknown> = {}) => Array.from({ length: n }, (_, i) => ({
  employee_code: `E${i + 1}`, full_name: `PERSONA ${i + 1}`, gender: i % 2 ? 'M' : 'F', category: 'PROD', funzione: i < 6 ? 'PRODUZIONE' : 'IT',
  area: 'Produzione', sede: 'Stabilimento', fte: 1, hours_paid: 1720, base_pay: 30000, variable_pay: 0, ...extra
}));
const importPeriod = (user: string, ws: unknown[], market: unknown[] = []) =>
  as<{ id: string }>(db, user, `select public.import_period($1, 'dati.xlsx', '[]', $2::jsonb, $3::jsonb) as id`, [period, JSON.stringify(ws), JSON.stringify(market)]);

beforeAll(async () => {
  db = await freshDb();
  await db.query(`insert into auth.users (id) select unnest($1::uuid[])`, [Object.values(U)]);
  org = (await as<{ id: string }>(db, U.admin, `select public.create_organization('Azienda') as id`))[0]!.id;
  // l'admin si assegna anche il ruolo HR rischio: più ruoli per la stessa persona
  await as(db, U.admin, `insert into public.memberships (org_id, user_id, role) values ($1,$2,'hr_rischio'),($1,$3,'hr'),($1,$4,'lettore')`, [org, U.admin, U.hr, U.read]);
  period = (await as<{ id: string }>(db, U.hr, `insert into public.periods (org_id, label, starts_on, ends_on) values ($1,'2025','2025-01-01','2025-12-31') returning id`, [org]))[0]!.id;
  await importPeriod(U.hr, people(8), [{ funzione: 'PRODUZIONE', annual_pay: 34400 }]);
  const ids = await as<{ id: string }>(db, U.hr, `select id from public.workers order by employee_code`);
  for (const [i, w] of ids.entries())
    await as(db, U.admin, `insert into public.risk_assessments (org_id, worker_id, model_version, factors, score, level, priority) values ($1,$2,'1.0.0','{}',$3,$4,$5)`,
      [org, w.id, i < 2 ? 85 : 35, i < 2 ? 'Alto' : 'Basso', i < 2 ? 'Critica' : 'Media']);
});

describe('import atomico', () => {
  it('ricaricare il file aggiorna le persone senza perdere valutazioni e casi', async () => {
    const w1 = (await as<{ id: string }>(db, U.hr, `select id from public.workers where employee_code = 'E1'`))[0]!.id;
    await as(db, U.admin, `insert into public.cases (org_id, worker_id, priority) values ($1,$2,'Critica')`, [org, w1]);
    await importPeriod(U.hr, people(8, { base_pay: 31000 }));
    const after = await as<{ id: string; base_pay: string }>(db, U.hr, `select id, base_pay from public.workers where employee_code = 'E1'`);
    expect(after[0]).toEqual({ id: w1, base_pay: '31000.00' });
    expect(await as(db, U.admin, `select id from public.cases`)).toHaveLength(1);
    expect(await as(db, U.admin, `select * from public.open_risk($1, 'verifica dopo il ricaricamento')`, [w1])).toHaveLength(1);
  });
  it('chi non è più nel file viene tolto dal periodo', async () => {
    await importPeriod(U.hr, people(7));
    expect(await as(db, U.hr, `select 1 from public.workers`)).toHaveLength(7);
    await importPeriod(U.hr, people(8));
  });
  it('se una riga è sbagliata non entra nulla', async () => {
    const bad = [...people(8), { ...people(1)[0], employee_code: 'X', fte: 5 }];
    await expect(importPeriod(U.hr, bad)).rejects.toThrow(/fte_check|check constraint/);
    expect(await as(db, U.hr, `select 1 from public.workers`)).toHaveLength(8);
  });
  it('il lettore non può importare', async () => {
    await expect(importPeriod(U.read, people(2))).rejects.toThrow(/Non autorizzato/);
  });
});

describe('lista Segnali', () => {
  it('HR rischio vede nomi e priorità ma nessun punteggio', async () => {
    const rows = await as<Record<string, unknown>>(db, U.admin, `select * from public.risk_list($1)`, [period]);
    expect(rows).toHaveLength(8);
    expect(Object.keys(rows[0]!)).not.toContain('score');
    expect(Object.keys(rows[0]!)).not.toContain('level');
    expect(rows.filter(r => r.priority === "Critica")).toHaveLength(2);
  });
  it('HR semplice e lettore non accedono alla lista', async () => {
    for (const u of [U.hr, U.read]) await expect(as(db, u, `select * from public.risk_list($1)`, [period])).rejects.toThrow(/Non autorizzato/);
  });
  it('monitora/rinvia solo per HR rischio', async () => {
    const w = (await as<{ id: string }>(db, U.hr, `select id from public.workers limit 1`))[0]!.id;
    await as(db, U.admin, `insert into public.worker_flags (worker_id, org_id, state) values ($1,$2,'snooze')`, [w, org]);
    await expect(as(db, U.hr, `insert into public.worker_flags (worker_id, org_id, state) values ($1,$2,'auto') on conflict (worker_id) do update set state = 'auto'`, [w, org])).rejects.toThrow(/row-level security/);
  });
});

describe('aggregati per tutti i membri', () => {
  it('il lettore vede il Quadro senza nomi', async () => {
    const o = (await as<{ v: Record<string, unknown> }>(db, U.read, `select public.risk_overview($1) as v`, [period]))[0]!.v;
    // 7 valutate: E8 è uscita e rientrata nel test precedente come persona nuova, senza valutazione
    expect(o).toMatchObject({ persone: 8, valutate: 7, rischio_alto: 2, critiche: 2 });
    expect((o.fasce as number[]).reduce((a, b) => a + b, 0)).toBe(7);
  });
  it('i gruppi sotto 5 persone mostrano solo il numero di persone', async () => {
    const g = await as<{ grp: string; persone: number; visibile: boolean; rischio_medio: string | null; mercato_orario: string | null }>(
      db, U.read, `select * from public.risk_groups($1, 'Produzione')`, [period]);
    const prod = g.find(r => r.grp === 'PRODUZIONE')!, it_ = g.find(r => r.grp === 'IT')!;
    expect(prod.visibile).toBe(true);
    expect(Number(prod.mercato_orario)).toBeCloseTo(34400 / 1730, 2);
    expect(it_).toMatchObject({ visibile: false, rischio_medio: null });
  });
  it("un'altra azienda non vede gli aggregati", async () => {
    await expect(as(db, U.other, `select public.risk_overview($1)`, [period])).rejects.toThrow(/Non autorizzato/);
  });
});
