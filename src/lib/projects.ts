import "server-only";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type Project = {
  id: string;
  name: string;
  kind: "campaign" | "app";
  created_at: string;
  updated_at: string;
};

export const projectId = z.string().uuid();
export const projectName = z
  .string()
  .trim()
  .min(1, "Dê um nome ao projeto.")
  .max(120, "Use até 120 caracteres.");

const COLUMNS = "id, name, kind, created_at, updated_at";

// O RLS já limita ao dono; requireUser garante que há sessão válida antes de consultar.
export async function listProjects(): Promise<Project[]> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select(COLUMNS)
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) throw new Error("Não foi possível carregar os projetos.");
  return data as Project[];
}

export async function getProject(id: string): Promise<Project | null> {
  if (!projectId.safeParse(id).success) return null;
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("projects").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error("Não foi possível carregar o projeto.");
  return data as Project | null;
}
