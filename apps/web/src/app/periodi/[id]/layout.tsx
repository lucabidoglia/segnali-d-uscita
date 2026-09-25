import Link from "next/link";
import { notFound } from "next/navigation";
import { PeriodTabs } from "@/components/PeriodTabs";
import { dIt } from "@/lib/format";
import { canRisk, canSeePay, session } from "@/lib/supabase/server";
import { loadPeriod } from "./data";

export default async function PeriodLayout({ children, params }: LayoutProps<"/periodi/[id]">) {
  const { id } = await params;
  const { sb, membership } = await session();
  if (!membership) notFound();
  const period = await loadPeriod(sb, id);
  if (!period) notFound();
  const pay = canSeePay(membership), risk = canRisk(membership);
  const tabs: [string, string][] = [
    ["quadro", "Quadro"],
    ...(risk ? [["segnali", "Segnali"], ["valutazione", "Valutazione"]] as [string, string][] : []),
    ["funzioni", "Funzioni & rischio"],
    ...(pay ? [["equita", "Equità"]] as [string, string][] : []),
    ["", pay ? "Dati & report Direttiva" : "Report Direttiva"],
    ...(pay ? [["documenti", "Documenti"]] as [string, string][] : []),
    ...(risk ? [["registro", "Registro"]] as [string, string][] : []),
  ];
  return (
    <div className="space-y-5">
      <div>
        <Link href="/" className="text-sm text-mut">← Periodi</Link>
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-2xl font-semibold">{period.label}</h1>
          <span className="text-sm text-mut">{dIt(period.starts_on)} – {dIt(period.ends_on)}</span>
        </div>
      </div>
      <PeriodTabs base={`/periodi/${id}`} tabs={tabs} />
      {children}
    </div>
  );
}
