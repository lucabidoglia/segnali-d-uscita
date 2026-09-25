"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { session, supabase } from "@/lib/supabase/server";

export async function signOut() {
  const sb = await supabase();
  await sb.auth.signOut();
  redirect("/login");
}

export async function createOrganization(fd: FormData) {
  const { sb } = await session();
  const name = String(fd.get("name") ?? "").trim();
  if (!name) redirect("/?e=" + encodeURIComponent("Inserisci la ragione sociale."));
  const { error } = await sb.rpc("create_organization", { p_name: name, p_vat: String(fd.get("vat") ?? "").trim() || null });
  if (error) redirect("/?e=" + encodeURIComponent(error.message));
  revalidatePath("/", "layout");
  redirect("/");
}

export async function createPeriod(fd: FormData) {
  const { sb, membership } = await session();
  if (!membership) redirect("/");
  const { data, error } = await sb.from("periods").insert({
    org_id: membership.org_id, label: String(fd.get("label")).trim(), starts_on: fd.get("start"), ends_on: fd.get("end"),
  }).select("id").single();
  if (error) redirect("/?e=" + encodeURIComponent(error.code === "23505" ? "Esiste già un periodo con questo nome." : error.message));
  redirect(`/periodi/${data.id}`);
}
