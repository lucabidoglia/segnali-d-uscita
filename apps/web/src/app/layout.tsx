import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { ThemeToggle } from "@/components/ThemeToggle";
import { session } from "@/lib/supabase/server";
import { signOut } from "./actions";

export const metadata: Metadata = {
  title: "Segnali d'uscita · G1G10",
  description: "Equità retributiva (Dir. UE 2023/970) e rischio di uscita",
  icons: { icon: "/favicon.svg" },
};

const ROLE: Record<string, string> = { admin: "Amministratore", hr: "HR", hr_rischio: "HR rischio", revisore: "Revisore", lettore: "Lettore" };
const THEME = `try{var t=localStorage.getItem('sdu_theme')||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');document.documentElement.dataset.theme=t}catch(e){}`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { user, membership } = await session();
  return (
    <html lang="it" className="h-full antialiased" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME }} /></head>
      <body className="flex min-h-full flex-col">
        <header className="flex items-center gap-4 border-b border-line bg-card px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/favicon.svg" alt="" width={26} height={26} /> Segnali d&apos;uscita
          </Link>
          {membership && <span className="hidden text-sm text-mut sm:inline">· {membership.orgName}</span>}
          <span className="grow" />
          <ThemeToggle />
          {user && (
            <div className="flex items-center gap-3 text-sm">
              <span className="hidden text-right text-mut md:inline">{user.email}{membership ? ` · ${membership.roles.map(r => ROLE[r]).join(", ")}` : ""}</span>
              {membership && membership.roles.some(r => r === "admin" || r === "revisore") && <Link className="btn-sec" href="/audit">Registri</Link>}
              {membership && <Link className="btn-sec" href="/mercato">Medie di mercato</Link>}
              {membership && <Link className="btn-sec" href="/impostazioni">Impostazioni</Link>}
              <form action={signOut}><button className="btn-sec">Esci</button></form>
            </div>
          )}
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">{children}</main>
        <footer className="px-6 py-4 text-center text-xs text-mut">Powered by <b>G1G10</b> · ambiente di sviluppo: usare solo dati inventati</footer>
      </body>
    </html>
  );
}
