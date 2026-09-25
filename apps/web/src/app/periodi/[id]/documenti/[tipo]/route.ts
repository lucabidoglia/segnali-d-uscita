import type { NextRequest } from "next/server";
import { ENGINE_VERSION } from "@g1g10/engine";
import { HORIZONS, horizon } from "@/lib/actionPlan";
import { divarioHtml, paritaHtml, pianoHtml, schedaHtml, slug, wrapDoc, type DocCtx } from "@/lib/docs";
import { loadSettings } from "@/lib/settings";
import { canSeePay, session } from "@/lib/supabase/server";
import { loadDbWorkers, loadPeriod } from "../../data";
import { loadPlan } from "../../piano/shared";

/**
 * /periodi/:id/documenti/:tipo?formato=anteprima|stampa|word
 *   tipo = scheda (con w=<id> o ids=<id>&ids=… o scope=all|a:<area>) · divario · parita · piano
 */
export async function GET(req: NextRequest, { params }: RouteContext<"/periodi/[id]/documenti/[tipo]">) {
  const { id, tipo } = await params;
  const q = req.nextUrl.searchParams, formato = q.get("formato") ?? "anteprima";
  const { sb, membership } = await session();
  if (!membership || !canSeePay(membership)) return new Response("Non autorizzato", { status: 403 });
  const period = await loadPeriod(sb, id);
  if (!period) return new Response("Periodo non trovato", { status: 404 });
  const ctx: DocCtx = { s: await loadSettings(sb, membership.org_id, membership.orgName), period, version: ENGINE_VERSION };
  const ws = await loadDbWorkers(sb, id);
  const day = new Date().toISOString().slice(0, 10);

  let name: string, html: string;
  if (tipo === "scheda") {
    const ids = [...q.getAll("ids"), ...q.getAll("w")], scope = q.get("scope");
    const list = ids.length ? ws.filter(w => ids.includes(w.id)) : scope === "all" ? ws : scope?.startsWith("a:") ? ws.filter(w => (w.area ?? "—") === scope.slice(2)) : [];
    if (!list.length) return new Response("Nessuna persona selezionata", { status: 400 });
    name = list.length === 1 ? `Scheda_formazione_${slug(list[0]!.full_name ?? list[0]!.employee_code)}` : `Fascicolo_schede_formazione_${scope?.startsWith("a:") ? slug(scope.slice(2)) : "selezione"}`;
    html = list.map(w => schedaHtml(ctx, w)).join("");
  } else if (tipo === "divario") { name = `Relazione_divario_retributivo_${day}`; html = divarioHtml(ctx, ws); }
  else if (tipo === "parita") { name = `Dossier_parita_di_genere_${day}`; html = paritaHtml(ctx, ws); }
  else if (tipo === "piano") {
    const { planned, today } = await loadPlan(sb, membership, id);
    name = `Piano_d_azione_${slug(period.label)}_${day}`;
    html = pianoHtml(ctx, planned, due => horizon(today, due), HORIZONS);
  }
  else return new Response("Documento sconosciuto", { status: 404 });

  if (!ws.length && tipo !== "piano") return new Response("Nessun dato nel periodo", { status: 400 });
  const doc = wrapDoc(name, html, formato === "stampa");
  if (formato === "word") return new Response("﻿" + doc, { headers: { "Content-Type": "application/msword", "Content-Disposition": `attachment; filename="${name}.doc"` } });
  return new Response(doc, { headers: { "Content-Type": "text/html; charset=utf-8", "X-Frame-Options": "SAMEORIGIN" } });
}
