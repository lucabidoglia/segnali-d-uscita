import { canRisk, session } from "@/lib/supabase/server";
import { loadCases } from "../shared";

const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export async function GET(_: Request, { params }: RouteContext<"/periodi/[id]/registro/csv">) {
  const { id } = await params;
  const { sb, membership } = await session();
  if (!canRisk(membership)) return new Response("Non autorizzato", { status: 403 });
  const rows = (await loadCases(sb, id)).map(c => [c.created_at.slice(0, 10), c.workers.employee_code, c.workers.full_name, c.workers.funzione, c.priority, c.status, c.note]);
  const csv = "﻿" + [["Data", "Matricola", "Persona", "Funzione", "Priorità", "Stato", "Note"], ...rows].map(r => r.map(q).join(";")).join("\n");
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="registro_${new Date().toISOString().slice(0, 10)}.csv"` } });
}
