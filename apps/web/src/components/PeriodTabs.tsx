"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function PeriodTabs({ base, tabs }: { base: string; tabs: [string, string][] }) {
  const path = usePathname();
  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto border-b border-line" aria-label="Sezioni del periodo">
      {tabs.map(([seg, label]) => {
        const href = seg ? `${base}/${seg}` : base;
        const on = seg ? path.startsWith(href) : path === base;
        return (
          <Link key={seg} href={href} aria-current={on ? "page" : undefined}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm ${on ? "border-brand font-semibold text-fg" : "border-transparent text-mut hover:text-fg"}`}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
