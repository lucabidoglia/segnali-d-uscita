import "server-only";
import type { Client } from "./supabase/server";

export const DEFAULT_SETTINGS = {
  ragione: "", piva: "", sede: "", firma: "Il Legale Rappresentante", fondo: "Fondimpresa", avviso: "", ccnl: "",
  ore: 1720, inps: 30, inailU: 0.8, inailP: 3.5, tfr: 7.41,
};
export type Settings = typeof DEFAULT_SETTINGS;

export const SETTINGS_FIELDS: [keyof Settings, string, "text" | "number"][] = [
  ["ragione", "Ragione sociale", "text"], ["piva", "Partita IVA", "text"], ["sede", "Sede legale (Via, CAP Città)", "text"],
  ["firma", "Firmatario", "text"], ["fondo", "Fondo / programma di finanziamento", "text"], ["avviso", "Avviso", "text"],
  ["ccnl", "CCNL applicato", "text"], ["ore", "Ore annue di riferimento (FSE)", "number"], ["inps", "INPS a carico azienda (%)", "number"],
  ["inailU", "INAIL uffici (%)", "number"], ["inailP", "INAIL produzione e logistica (%)", "number"], ["tfr", "TFR (%)", "number"],
];

export async function loadSettings(sb: Client, orgId: string, orgName: string): Promise<Settings> {
  const { data } = await sb.from("org_settings").select("data").eq("org_id", orgId).maybeSingle();
  return { ...DEFAULT_SETTINGS, ragione: orgName, ...((data?.data as Partial<Settings>) ?? {}) };
}
