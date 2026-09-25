import { NextResponse, type NextRequest } from "next/server";
import { supabase } from "@/lib/supabase/server";

/** Arrivo dal link di conferma nell'email: scambia il codice con la sessione. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const origin = request.nextUrl.origin;
  if (code) {
    const sb = await supabase();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/`);
  }
  return NextResponse.redirect(`${origin}/login?e=${encodeURIComponent("Link non valido o scaduto: accedi di nuovo.")}`);
}
