"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { projectId, projectName } from "@/lib/projects";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string };

export async function createProject(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const name = projectName.safeParse(formData.get("name"));
  if (!name.success) return { error: name.error.issues[0]?.message };

  const supabase = await createClient();
  const { data, error } = await supabase.from("projects").insert({ name: name.data }).select("id").single();
  if (error || !data) return { error: "Não foi possível criar o projeto. Tente de novo." };

  revalidatePath("/app");
  redirect(`/app/projetos/${data.id}`);
}

export async function renameProject(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const id = projectId.safeParse(formData.get("id"));
  const name = projectName.safeParse(formData.get("name"));
  if (!id.success) return { error: "Projeto inválido." };
  if (!name.success) return { error: name.error.issues[0]?.message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .update({ name: name.data })
    .eq("id", id.data)
    .select("id");
  if (error || !data?.length) return { error: "Não foi possível renomear." };

  revalidatePath("/app");
  revalidatePath(`/app/projetos/${id.data}`);
  return {};
}

export async function deleteProject(formData: FormData): Promise<void> {
  await requireUser();
  const id = projectId.safeParse(formData.get("id"));
  if (!id.success) return;

  const supabase = await createClient();
  await supabase.from("projects").delete().eq("id", id.data);

  revalidatePath("/app");
  redirect("/app");
}
