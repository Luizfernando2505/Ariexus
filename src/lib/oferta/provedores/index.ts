import { criarProvedorAnthropic, PRECOS } from "./anthropic";
import { criarProvedorSimulado } from "./simulado";
import type { ModoAnalise, ProvedorAnalise } from "./tipos";

type Ambiente = Record<string, string | undefined>;

/**
 * Qual provedor gera a análise neste servidor.
 * - anthropic: só com ANALISE_PROVEDOR=anthropic E ANTHROPIC_API_KEY definidas. Hoje nenhuma das duas existe.
 * - simulado: padrão fora da produção (dev, testes e previews da Vercel). Nunca em produção.
 * - desligado: padrão em produção. A página é lida e mostrada, sem análise.
 */
export function modoAnalise(env: Ambiente = process.env): ModoAnalise {
  const pedido = env.ANALISE_PROVEDOR?.trim().toLowerCase();
  const producao = env.VERCEL_ENV === "production";
  if (pedido === "anthropic") return env.ANTHROPIC_API_KEY ? "anthropic" : "desligado";
  if (pedido === "desligado") return "desligado";
  return producao ? "desligado" : "simulado";
}

export function criarProvedor(modo: ModoAnalise, env: Ambiente = process.env): ProvedorAnalise | null {
  if (modo === "anthropic" && env.ANTHROPIC_API_KEY) {
    // Só modelos com preço na tabela, para o custo salvo ser sempre calculável.
    const modelo = env.ANALISE_MODELO?.trim();
    return criarProvedorAnthropic({ apiKey: env.ANTHROPIC_API_KEY, modelo: modelo && modelo in PRECOS ? modelo : undefined });
  }
  if (modo === "simulado") return criarProvedorSimulado();
  return null;
}

export type { ModoAnalise, ProvedorAnalise } from "./tipos";
