import "server-only";
import * as z from "zod/v4";
import { requireUser } from "@/lib/auth";
import { DadosOferta } from "@/lib/oferta/entrada";
import { Analise, PaginaSalva } from "@/lib/oferta/schema";
import { createClient } from "@/lib/supabase/server";

// Leitura das análises salvas. O RLS limita ao dono; o formato é conferido antes de chegar na tela.

export type ResumoAnalise = {
  id: string;
  url_final: string;
  status: "concluida" | "somente_leitura";
  modo: "desligado" | "simulado" | "anthropic";
  titulo: string | null;
  created_at: string;
};

export type AnaliseCompleta = ResumoAnalise & {
  url: string;
  entrada: DadosOferta | null;
  pagina: PaginaSalva | null;
  texto_pagina: string;
  resultado: Analise | null;
  /** O resultado salvo existe mas está fora do formato esperado. */
  ilegivel: boolean;
  modelo: string | null;
  tokens_entrada: number | null;
  tokens_saida: number | null;
  custo_usd: number | null;
};

export type UsoAtual = { analisesUsadas: number; analisesLimite: number; leiturasUsadas: number; leiturasLimite: number };

const uuid = z.uuid();

export async function listarAnalises(projectId: string): Promise<ResumoAnalise[]> {
  if (!uuid.safeParse(projectId).success) return [];
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("analyses")
    .select("id, url_final, status, modo, created_at, titulo:pagina->>titulo")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error("Não foi possível carregar as análises.");
  return data as ResumoAnalise[];
}

export async function buscarAnalise(projectId: string, id: string): Promise<AnaliseCompleta | null> {
  if (!uuid.safeParse(projectId).success || !uuid.safeParse(id).success) return null;
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("analyses")
    .select(
      "id, url, url_final, status, modo, created_at, entrada, pagina, texto_pagina, resultado, modelo, tokens_entrada, tokens_saida, custo_usd",
    )
    .eq("project_id", projectId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Não foi possível carregar a análise.");
  if (!data) return null;

  const pagina = PaginaSalva.safeParse(data.pagina);
  const resultado = data.resultado === null ? null : Analise.safeParse(data.resultado);
  const entrada = DadosOferta.safeParse(data.entrada);
  return {
    ...(data as Omit<AnaliseCompleta, "pagina" | "resultado" | "entrada" | "ilegivel" | "titulo">),
    custo_usd: data.custo_usd === null ? null : Number(data.custo_usd),
    titulo: pagina.success ? pagina.data.titulo : null,
    entrada: entrada.success ? entrada.data : null,
    pagina: pagina.success ? pagina.data : null,
    resultado: resultado?.success ? resultado.data : null,
    ilegivel: (resultado !== null && !resultado.success) || !pagina.success,
  };
}

export async function consultarUso(): Promise<UsoAtual | null> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("consultar_uso").maybeSingle<{
    analises_usadas: number;
    analises_limite: number;
    leituras_usadas: number;
    leituras_limite: number;
  }>();
  if (error || !data) return null;
  return {
    analisesUsadas: data.analises_usadas,
    analisesLimite: data.analises_limite,
    leiturasUsadas: data.leituras_usadas,
    leiturasLimite: data.leituras_limite,
  };
}
