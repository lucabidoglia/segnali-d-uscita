"use server";
import { redirect } from "next/navigation";
import { canRisk, session } from "@/lib/supabase/server";
import { loadSignals } from "./shared";

type Act = "case" | "auto" | "snooze" | "unflag";

async function apply(periodId: string, ids: string[], act: Act, back: string) {
  const { sb, membership } = await session();
  if (!membership || !canRisk(membership)) redirect(`/periodi/${periodId}`);
  const list = (await loadSignals(sb, periodId)).filter(s => ids.includes(s.worker_id));
  let msg = "";
  if (act === "case") {
    const { error } = await sb.from("cases").insert(list.map(s => ({ org_id: membership.org_id, worker_id: s.worker_id, priority: s.priority ?? "Non valutata", note: null })));
    msg = error ? error.message : `${list.length} ${list.length === 1 ? "caso aperto" : "casi aperti"} nel Registro`;
  } else if (act === "unflag") {
    const { error } = await sb.from("worker_flags").delete().in("worker_id", list.map(s => s.worker_id));
    msg = error ? error.message : `${list.length} riattivati`;
  } else {
    const { error } = await sb.from("worker_flags").upsert(list.map(s => ({ worker_id: s.worker_id, org_id: membership.org_id, state: act, updated_at: new Date().toISOString() })));
    msg = error ? error.message : `${list.length} ${act === "auto" ? "in monitoraggio" : "rinviati"}`;
  }
  redirect(`${back}${back.includes("?") ? "&" : "?"}m=${encodeURIComponent(msg)}`);
}

const ids = (fd: FormData) => fd.getAll("ids").map(String);
const backOf = (fd: FormData, periodId: string) => String(fd.get("back") || `/periodi/${periodId}/segnali`);

export async function bulk(periodId: string, act: Act, fd: FormData) {
  const sel = ids(fd);
  if (!sel.length) redirect(backOf(fd, periodId));
  await apply(periodId, sel, act, backOf(fd, periodId));
}

export async function rowAction(periodId: string, workerId: string, act: Act, fd: FormData) {
  await apply(periodId, [workerId], act, backOf(fd, periodId));
}
