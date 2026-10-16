import Anthropic from "@anthropic-ai/sdk";
import { ErroAnalise } from "../erros";
import { INSTRUCOES, montarMensagem } from "../prompt";
import { esquemaJsonParaApi } from "../schema";
import type { PedidoAnalise, ProvedorAnalise, RespostaProvedor, UsoModelo } from "./tipos";

// Conector da API da Anthropic. Pronto, mas DESLIGADO: só é usado quando
// ANALISE_PROVEDOR=anthropic e ANTHROPIC_API_KEY existem no servidor (ver modo.ts).
// A chave nunca sai do servidor e nunca vai para o navegador.

export const MODELO_PADRAO = "claude-opus-5-5";
const MAX_TOKENS = 16_000;
const TEMPO_LIMITE_MS = 120_000;

/** Dólares por milhão de tokens (preços oficiais conferidos em 16/10/2026). */
export const PRECOS: Record<string, { entrada: number; saida: number }> = {
  "claude-opus-5-5": { entrada: 4, saida: 20 },
  "claude-sonnet-5-5": { entrada: 2, saida: 10 },
  "claude-haiku-5-5": { entrada: 0.1, saida: 0.5 },
};

export type OpcoesAnthropic = {
  apiKey: string;
  modelo?: string;
  /** Só para testes: substitui a rede. */
  fetch?: typeof fetch;
};

export function criarProvedorAnthropic(opcoes: OpcoesAnthropic): ProvedorAnalise {
  const modelo = opcoes.modelo ?? MODELO_PADRAO;
  const cliente = new Anthropic({
    apiKey: opcoes.apiKey,
    fetch: opcoes.fetch,
    maxRetries: 1,
    timeout: TEMPO_LIMITE_MS,
  });

  return {
    modo: "anthropic",
    async analisar(pedido: PedidoAnalise): Promise<RespostaProvedor> {
      let resposta: Anthropic.Beta.BetaMessage;
      try {
        resposta = await cliente.beta.messages.create({
          model: modelo,
          max_tokens: MAX_TOKENS,
          betas: ["server-side-fallback-2026-07-01"],
          // Se o modelo recusar por política, a API tenta outro modelo (cobrado pelo preço dele).
          fallbacks: "default",
          system: INSTRUCOES,
          messages: [{ role: "user", content: montarMensagem(pedido.url, pedido.pagina, pedido.dados) }],
          output_config: { effort: "medium", format: { type: "json_schema", schema: esquemaJsonParaApi() } },
        });
      } catch (erro) {
        throw traduzirErroDaApi(erro);
      }

      const uso = calcularUso(resposta);
      // Toda chamada fica no log com o custo, inclusive as que falham depois daqui.
      console.info("[analise] chamada ao modelo", { ...uso, parada: resposta.stop_reason });
      if (resposta.stop_reason === "refusal") throw new ErroAnalise("ia_recusou");
      if (resposta.stop_reason === "max_tokens") throw new ErroAnalise("ia_resposta_incompleta");

      const texto = resposta.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      let conteudo: unknown;
      try {
        conteudo = JSON.parse(texto);
      } catch {
        throw new ErroAnalise("ia_resposta_invalida");
      }
      return { conteudo, modelo: resposta.model, uso };
    },
  };
}

/** Tokens e custo da chamada. Com fallback, cada modelo da cadeia é cobrado pelo próprio preço. */
export function calcularUso(resposta: Pick<Anthropic.Beta.BetaMessage, "model" | "usage">): UsoModelo {
  const u = resposta.usage;
  const etapas =
    u.iterations?.flatMap((i) =>
      "model" in i && i.model
        ? [{ modelo: i.model, entrada: i.input_tokens + i.cache_creation_input_tokens + i.cache_read_input_tokens, saida: i.output_tokens }]
        : [],
    ) ?? [];
  const lista = etapas.length
    ? etapas
    : [
        {
          modelo: resposta.model,
          entrada: u.input_tokens + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0),
          saida: u.output_tokens,
        },
      ];

  // Não usamos cache: se aparecer token de cache, entra pelo preço cheio de entrada.
  // Modelo fora da tabela é cobrado como o mais caro, para nunca subestimar o gasto.
  const custo = lista.reduce((total, e) => {
    const preco = PRECOS[e.modelo] ?? PRECOS[MODELO_PADRAO];
    return total + (e.entrada * preco.entrada + e.saida * preco.saida) / 1_000_000;
  }, 0);

  return {
    modelo: resposta.model,
    tokensEntrada: lista.reduce((t, e) => t + e.entrada, 0),
    tokensSaida: lista.reduce((t, e) => t + e.saida, 0),
    custoUsd: Math.round(custo * 1_000_000) / 1_000_000,
  };
}

function traduzirErroDaApi(erro: unknown): ErroAnalise {
  if (erro instanceof ErroAnalise) return erro;
  if (erro instanceof Anthropic.APIError) {
    // Registra no servidor só o status e o tipo, nunca a chave nem o conteúdo da página.
    console.error("[analise] erro da API da Anthropic", { status: erro.status, tipo: erro.name });
  } else {
    console.error("[analise] falha ao chamar a API da Anthropic", { tipo: (erro as Error)?.name });
  }
  return new ErroAnalise("ia_indisponivel");
}
