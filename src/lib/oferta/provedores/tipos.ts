import type { DadosOferta } from "../entrada";
import type { ConteudoPagina } from "../extrair";

// Contrato entre a análise e quem gera o resultado (simulador ou modelo de IA).
// Trocar ou ligar o modelo é trocar o provedor; o resto da análise não muda.

export type ModoAnalise = "desligado" | "simulado" | "anthropic";

export type PedidoAnalise = {
  url: string;
  pagina: ConteudoPagina;
  dados: DadosOferta;
};

export type UsoModelo = {
  modelo: string;
  tokensEntrada: number;
  tokensSaida: number;
  /** Custo calculado pela tabela de preços, em dólar. */
  custoUsd: number;
};

export type RespostaProvedor = {
  /** Resposta crua, ainda não validada. */
  conteudo: unknown;
  /** Nome do modelo que respondeu, ou "simulador". */
  modelo: string;
  uso: UsoModelo | null;
};

export interface ProvedorAnalise {
  readonly modo: Exclude<ModoAnalise, "desligado">;
  analisar(pedido: PedidoAnalise): Promise<RespostaProvedor>;
}
