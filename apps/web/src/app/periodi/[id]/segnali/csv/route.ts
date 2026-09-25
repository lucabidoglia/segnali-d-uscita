import type { NextRequest } from "next/server";
import { canRisk, session } from "@/lib/supabase/server";
import { loadSignals } from "../shared";

const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export async function GET(req: NextRequest, { params }: RouteContext<"/periodi/[id]/segnali/csv">) {
  const { id } = await params;
  const { sb, membership } = await session();
  if (!membership || !canRisk(membership)) return new Response("Non autorizzato", { status: 403 });
  const sel = new Set(req.nextUrl.searchParams.getAll("ids"));
  const rows = (await loadSignals(sb, id)).filter(s => !sel.size || sel.has(s.worker_id));
  const head = ["Matricola", "Persona", "Sede", "Area", "Funzione", "Anzianità (anni)", "Priorità", "Stato"];
  const body = rows.map(s => [s.employee_code, s.full_name, s.sede, s.area, s.funzione, s.seniority_years ?? "", s.priority ?? "Non valutata",
    s.flag === "auto" ? "Monitorato" : s.flag === "snooze" ? "Rinviato" : ""]);
  const csv = "﻿" + [head, ...body].map(r => r.map(q).join(";")).join("\n");
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="segnali_${new Date().toISOString().slice(0, 10)}.csv"` } });
}
