import Link from "next/link";

/** Percorso area → funzione (come il prototipo). */
export function Crumb({ base, area, fn }: { base: string; area?: string; fn?: string }) {
  return (
    <nav className="flex flex-wrap items-center gap-1 text-sm" aria-label="Percorso">
      {area ? <Link className="text-brand underline" href={base}>Tutte le aree</Link> : <b>Tutte le aree</b>}
      {area && <> › {fn ? <Link className="text-brand underline" href={`${base}?area=${encodeURIComponent(area)}`}>{area}</Link> : <b>{area}</b>}</>}
      {fn && <> › <b>{fn}</b></>}
    </nav>
  );
}
