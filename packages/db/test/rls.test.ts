import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { as, freshDb, uid } from './harness.js';

const U = { admin: uid(1), hr: uid(2), risk: uid(3), rev: uid(4), read: uid(5), otherAdmin: uid(6) };
let db: PGlite, orgA: string, orgB: string, period: string, workers: string[];

beforeAll(async () => {
  db = await freshDb();
  await db.query(`insert into auth.users (id) select unnest($1::uuid[])`, [Object.values(U)]);
  orgA = (await as<{ id: string }>(db, U.admin, `select public.create_organization('Azienda A') as id`))[0]!.id;
  orgB = (await as<{ id: string }>(db, U.otherAdmin, `select public.create_organization('Azienda B') as id`))[0]!.id;
  await as(db, U.admin, `insert into public.memberships (org_id, user_id, role) values ($1,$2,'hr'),($1,$3,'hr_rischio'),($1,$4,'revisore'),($1,$5,'lettore')`,
    [orgA, U.hr, U.risk, U.rev, U.read]);
  period = (await as<{ id: string }>(db, U.hr, `insert into public.periods (org_id, label, starts_on, ends_on) values ($1,'2026','2026-01-01','2026-12-31') returning id`, [orgA]))[0]!.id;
  workers = (await as<{ id: string }>(db, U.hr, `insert into public.workers (org_id, period_id, employee_code, gender, category, funzione, fte, hours_paid, base_pay)
    select $1, $2, 'M' || g, case when g % 2 = 0 then 'F' else 'M' end, 'PRODUZIONE', case when g <= 6 then 'PRODUZIONE' else 'IT' end, 1, 1720, 30000
    from generate_series(1, 8) g returning id`, [orgA, period])).map(r => r.id);
  for (const [i, w] of workers.entries())
    await as(db, U.risk, `insert into public.risk_assessments (org_id, worker_id, model_version, factors, score, level, priority) values ($1,$2,'1.0.0','{}',$3,$4,'Media')`,
      [orgA, w, i < 3 ? 80 : 30, i < 3 ? 'Alto' : 'Basso']);
});

const count = async (user: string | null, table: string) =>
  Number((await as<{ n: string }>(db, user, `select count(*) as n from public.${table}`))[0]!.n);

describe('separazione tra aziende', () => {
  it("l'admin di un'altra azienda non vede nulla di A", async () => {
    expect(await count(U.otherAdmin, 'workers')).toBe(0);
    expect((await as(db, U.otherAdmin, `select id from public.organizations`)).map(r => r.id)).toEqual([orgB]);
    expect(await count(U.otherAdmin, 'periods')).toBe(0);
  });
  it("non può scrivere dati dentro l'azienda A", async () => {
    await expect(as(db, U.otherAdmin, `insert into public.workers (org_id, period_id, employee_code, gender, category, funzione, fte, hours_paid, base_pay)
      values ($1,$2,'X','F','A','A',1,1,1)`, [orgA, period])).rejects.toThrow(/row-level security/);
  });
  it("non può aggiungersi come membro dell'azienda A", async () => {
    await expect(as(db, U.otherAdmin, `insert into public.memberships (org_id, user_id, role) values ($1,$2,'admin')`, [orgA, U.otherAdmin])).rejects.toThrow(/row-level security/);
  });
  it('un utente anonimo non vede nulla e non crea aziende', async () => {
    await expect(count(null, 'workers')).rejects.toThrow(/permission denied/);
    await expect(as(db, null, `select public.create_organization('X')`)).rejects.toThrow(/permission denied/);
  });
});

describe('dati retributivi individuali', () => {
  it('HR li vede, lettore e revisore no', async () => {
    expect(await count(U.hr, 'workers')).toBe(8);
    expect(await count(U.read, 'workers')).toBe(0);
    expect(await count(U.rev, 'workers')).toBe(0);
  });
  it('il lettore vede i periodi (per i report aggregati)', async () => {
    expect(await count(U.read, 'periods')).toBe(1);
  });
});

describe('rischio individuale: solo HR rischio, con motivazione, registrato', () => {
  it('nessuno legge la tabella direttamente, nemmeno admin e hr_rischio', async () => {
    for (const u of [U.admin, U.hr, U.risk]) expect(await count(u, 'risk_assessments')).toBe(0);
  });
  it('HR semplice non può né scrivere né aprire il rischio', async () => {
    await expect(as(db, U.hr, `insert into public.risk_assessments (org_id, worker_id, model_version, factors, score, level, priority) values ($1,$2,'1','{}',1,'Basso','Bassa')`,
      [orgA, workers[0]])).rejects.toThrow(/row-level security/);
    await expect(as(db, U.hr, `select * from public.open_risk($1, 'colloquio programmato')`, [workers[0]])).rejects.toThrow(/Non autorizzato/);
  });
  it('senza motivazione adeguata il rischio non si apre', async () => {
    await expect(as(db, U.risk, `select * from public.open_risk($1, 'boh')`, [workers[0]])).rejects.toThrow(/motivazione/);
  });
  it('con motivazione si apre e resta traccia; il revisore la vede, HR no', async () => {
    const r = await as<{ score: number }>(db, U.risk, `select * from public.open_risk($1, 'Colloquio di sviluppo del 30/09')`, [workers[0]]);
    expect(r[0]!.score).toBe(80);
    const log = await as<{ reason: string; user_id: string }>(db, U.rev, `select reason, user_id from public.risk_access_log`);
    expect(log).toEqual([{ reason: 'Colloquio di sviluppo del 30/09', user_id: U.risk }]);
    expect(await count(U.hr, 'risk_access_log')).toBe(0);
  });
  it("l'admin di un'altra azienda non apre il rischio di A", async () => {
    await expect(as(db, U.otherAdmin, `select * from public.open_risk($1, 'tentativo di accesso')`, [workers[0]])).rejects.toThrow(/Non autorizzato/);
  });
  it('il riepilogo aggregato è per tutti i membri e nasconde i gruppi piccoli', async () => {
    const s = await as<{ funzione: string; persone: string }>(db, U.read, `select * from public.risk_summary($1)`, [period]);
    expect(s.map(r => [r.funzione, Number(r.persone)])).toEqual([['PRODUZIONE', 6]]); // IT ha 2 persone → nascosto
    await expect(as(db, U.otherAdmin, `select * from public.risk_summary($1)`, [period])).rejects.toThrow(/Non autorizzato/);
  });
});

describe('registri a prova di manomissione', () => {
  it('ogni modifica finisce nel registro attività, che non si può alterare', async () => {
    expect(await count(U.rev, 'audit_log')).toBeGreaterThan(10);
    await expect(as(db, U.admin, `delete from public.audit_log`)).rejects.toThrow(/permission denied/);
    await expect(as(db, U.admin, `update public.audit_log set action = 'x'`)).rejects.toThrow(/permission denied/);
    await expect(as(db, U.admin, `insert into public.audit_log (table_name, action) values ('x','x')`)).rejects.toThrow(/permission denied/);
    await expect(as(db, U.rev, `delete from public.risk_access_log`)).rejects.toThrow(/permission denied/);
  });
  it('un report sul divario reso definitivo non si modifica né si cancella', async () => {
    const id = (await as<{ id: string }>(db, U.hr, `insert into public.pay_reports (org_id, period_id, engine_version, payload) values ($1,$2,'0.1.0','{"gapMean":4.2}') returning id`, [orgA, period]))[0]!.id;
    await as(db, U.hr, `update public.pay_reports set finalized_at = now() where id = $1`, [id]);
    await expect(as(db, U.hr, `update public.pay_reports set payload = '{"gapMean":0}' where id = $1`, [id])).rejects.toThrow(/non modificabile/);
    await expect(as(db, U.admin, `delete from public.pay_reports where id = $1`, [id])).rejects.toThrow(/non modificabile/);
    expect(await count(U.read, 'pay_reports')).toBe(1); // il lettore vede i report aggregati
  });
});

describe('permessi sulle funzioni (Security Advisor)', () => {
  it('nessuno può chiamare direttamente la funzione del registro attività', async () => {
    for (const u of [null, U.admin]) await expect(as(db, u, `select public.audit()`)).rejects.toThrow(/permission denied/);
  });
  it('gli anonimi non possono usare le funzioni delle regole di accesso', async () => {
    await expect(as(db, null, `select public.has_role($1, '{admin}')`, [orgA])).rejects.toThrow(/permission denied/);
    await expect(as(db, null, `select public.is_member($1)`, [orgA])).rejects.toThrow(/permission denied/);
  });
  it('gli utenti collegati sì (servono alle regole) e rispondono solo per sé stessi', async () => {
    expect((await as<{ ok: boolean }>(db, U.admin, `select public.is_member($1) as ok`, [orgA]))[0]!.ok).toBe(true);
    expect((await as<{ ok: boolean }>(db, U.otherAdmin, `select public.is_member($1) as ok`, [orgA]))[0]!.ok).toBe(false);
  });
  it('il registro attività continua a riempirsi dopo la revoca', async () => {
    const before = Number((await as<{ n: string }>(db, U.rev, `select count(*) n from public.audit_log`))[0]!.n);
    await as(db, U.hr, `insert into public.periods (org_id, label, starts_on, ends_on) values ($1,'Prova permessi','2027-01-01','2027-12-31')`, [orgA]);
    expect(Number((await as<{ n: string }>(db, U.rev, `select count(*) n from public.audit_log`))[0]!.n)).toBe(before + 1);
  });
});
