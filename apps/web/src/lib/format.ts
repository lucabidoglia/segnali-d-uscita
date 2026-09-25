export const eur0 = (n: number) => Math.round(n).toLocaleString("it-IT", { useGrouping: "always" } as Intl.NumberFormatOptions);
export const eur2 = (n: number) => n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: "always" } as Intl.NumberFormatOptions);
export const n1 = (v: number) => v.toLocaleString("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const pc = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? "n.d." : `${v > 0 ? "+" : ""}${n1(v)}%`);
export const dIt = (s: string) => new Date(s).toLocaleDateString("it-IT");
export const dtIt = (s: string) => new Date(s).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" });
export const qs = (base: Record<string, string | undefined>, patch: Record<string, string | undefined | null>) => {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...base, ...patch })) if (v !== undefined && v !== null && v !== "") u.set(k, v);
  const s = u.toString();
  return s ? `?${s}` : "";
};
/** Legge un parametro di ricerca come stringa singola. */
export const sp = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
