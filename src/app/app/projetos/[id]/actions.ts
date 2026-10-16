"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { analisarOferta, type ResultadoUso } from "@/lib/oferta/analisar";
import { lerFormulario } from "@/lib/oferta/entrada";
import { ErroAnalise, MENSAGENS } from "@/lib/oferta/erros";
import { lerPagina, redeLocalDeTeste } from "@/lib/oferta/ler-pagina";
import { criarProvedor, modoAnalise } from "@/lib/oferta/provedores";
import { getProject, projectId } from "@/lib/projects";
import { createClient } from "@/lib/supabase/server";

export type EstadoAnalise = {
  erro?: string;
  /** O que a pessoa digitou, para não perder o formulário quando dá erro. */
  valores?: Record<string, string>;
  /** Muda a cada envio para o formulário ser montado de novo com os valores acima. */
  tentativa?: number;
};

const CAMPOS = ["url", "perfil", "plataforma", "pais", "idioma"] as const;

export async function analisarOfertaAction(_prev: EstadoAnalise, formData: FormData): Promise<EstadoAnalise> {
  await requireUser();
  const tentativa = Date.now();
  const valores = Object.fromEntries(
    CAMPOS.map((c) => [c, String(formData.get(c) ?? "").slice(0, 2048)]),
  );
  const falha = (erro: string): EstadoAnalise => ({ erro, valores, tentativa });

  const id = projectId.safeParse(formData.get("projeto"));
  if (!id.success) return falha("Projeto inválido.");
  const dados = lerFormulario(formData);
  if (!dados.success) return falha(dados.error.issues[0]?.message ?? "Confira os dados do formulário.");
  if (!(await getProject(id.data))) return falha("Projeto não encontrado.");

  const supabase = await createClient();
  const modo = modoAnalise();
  const permitirLoopback = redeLocalDeTeste();

  let resultado;
  try {
    resultado = await analisarOferta(dados.data, {
      async registrarUso(tipo) {
        const { data, error } = await supabase.rpc("registrar_uso", { p_kind: tipo }).single<ResultadoUso>();
        if (error || !data) throw new Error(`registrar_uso falhou: ${error?.code ?? "sem dados"}`);
        return data;
      },
      lerPagina: (url) => lerPagina(url, { permitirLoopback }),
      provedor: criarProvedor(modo),
      opcoesUrl: { permitirLoopback },
    });
  } catch (erro) {
    if (erro instanceof ErroAnalise) return falha(erro.paraUsuario);
    console.error("[analise] erro inesperado", { tipo: (erro as Error)?.name, mensagem: (erro as Error)?.message });
    return falha(MENSAGENS.erro_interno);
  }

  const ia =
    resultado.status === "concluida"
      ? {
          resultado: resultado.analise,
          modelo: resultado.modelo,
          tokens_entrada: resultado.uso?.tokensEntrada ?? null,
          tokens_saida: resultado.uso?.tokensSaida ?? null,
          custo_usd: resultado.uso?.custoUsd ?? null,
        }
      : { resultado: null, modelo: null, tokens_entrada: null, tokens_saida: null, custo_usd: null };
  const { error } = await supabase.from("analyses").insert({
    project_id: id.data,
    url: resultado.url,
    url_final: resultado.urlFinal,
    entrada: dados.data,
    status: resultado.status,
    modo: resultado.modo,
    pagina: resultado.pagina,
    texto_pagina: resultado.texto,
    ...ia,
  });
  if (error) {
    console.error("[analise] falha ao salvar", { codigo: error.code });
    return falha("A página foi lida, mas a análise não foi salva. Tente de novo.");
  }

  revalidatePath(`/app/projetos/${id.data}`);
  return { tentativa };
}

const ids = z.object({ projeto: projectId, analise: z.string().uuid() });

export async function excluirAnalise(formData: FormData): Promise<void> {
  await requireUser();
  const parsed = ids.safeParse({ projeto: formData.get("projeto"), analise: formData.get("analise") });
  if (!parsed.success) return;

  const supabase = await createClient();
  await supabase.from("analyses").delete().eq("id", parsed.data.analise).eq("project_id", parsed.data.projeto);

  revalidatePath(`/app/projetos/${parsed.data.projeto}`);
  redirect(`/app/projetos/${parsed.data.projeto}`);
}
