import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { session } from "@/lib/supabase/server";
import { signOut } from "./actions";

export const metadata: Metadata = {
  title: "Segnali d'uscita · G1G10",
  description: "Equità retributiva (Dir. UE 2023/970) e rischio di uscita",
  icons: { icon: "/favicon.svg" },
};

const ROLE: Record<string, string> = { admin: "Amministratore", hr: "HR", hr_rischio: "HR rischio", revisore: "Revisore", lettore: "Lettore" };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { user, membership } = await session();
  return (
    <html lang="it" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <header className="flex items-center gap-4 border-b border-line bg-card px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <img src="/favicon.svg" alt="" width={26} height={26} /> Segnali d&apos;uscita
          </Link>
          {membership && <span className="hidden text-sm text-mut sm:inline">· {membership.organizations.name}</span>}
          <span className="grow" />
          {user && (
            <div className="flex items-center gap-3 text-sm">
              <span className="hidden text-mut sm:inline">{user.email}{membership ? ` · ${ROLE[membership.role]}` : ""}</span>
              <form action={signOut}><button className="btn-sec">Esci</button></form>
            </div>
          )}
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">{children}</main>
        <footer className="px-6 py-4 text-center text-xs text-mut">Powered by <b>G1G10</b> · ambiente di sviluppo: usare solo dati inventati</footer>
      </body>
    </html>
  );
}
