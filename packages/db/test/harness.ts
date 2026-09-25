// PostgreSQL in memoria con un'imitazione minima dell'ambiente Supabase (ruoli anon/authenticated, auth.uid()),
// su cui si applicano le migrazioni vere di supabase/migrations.
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';

const MIG = new URL('../../../supabase/migrations/', import.meta.url);

const SUPABASE_STUB = `
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth, public to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
  alter default privileges in schema public grant usage on sequences to anon, authenticated;
`;

export async function freshDb() {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const f of readdirSync(MIG).filter(f => f.endsWith('.sql')).sort()) await db.exec(readFileSync(new URL(f, MIG), 'utf8'));
  return db;
}

export const uid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;

/** Esegue `sql` come l'utente `user` (o anonimo se null), con RLS attiva. */
export async function as<T = Record<string, unknown>>(db: PGlite, user: string | null, sql: string, params: unknown[] = []) {
  return db.transaction(async tx => {
    await tx.exec(`set local role ${user ? 'authenticated' : 'anon'}`);
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [user ?? '']);
    return (await tx.query<T>(sql, params)).rows;
  });
}
