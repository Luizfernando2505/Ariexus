import { ErroAnalise } from "../erros";
import type { RespostaModelo } from "../schema";
import type { PedidoAnalise, ProvedorAnalise, RespostaProvedor } from "./tipos";

// SIMULADOR: monta uma "análise" com regras simples, sem IA e sem custo, para testar
// a tela, o salvamento, os limites e a conferência dos trechos enquanto a IA está desligada.
// Tudo o que ele escreve começa com [Simulação]. Não serve para decidir nada sobre a oferta.

export const MODELO_SIMULADO = "simulador";
export const AVISO_SIMULACAO =
  "SIMULAÇÃO: este resultado foi montado por regras simples, sem IA, só para testar a tela e o salvamento. Não use para decidir nada sobre a oferta.";
export const TRECHO_INVENTADO = "Este trecho foi inventado pelo simulador e não existe na página";

/** Só para testes automáticos: força as falhas que o modelo de verdade pode ter. */
export type CenarioSimulado = "normal" | "formato_invalido" | "recusa" | "incompleta" | "indisponivel";

type Campo = RespostaModelo["produto"]["nome"];
type ItemLista = RespostaModelo["produto"]["bonus"][number];

const S = (t: string) => `[Simulação] ${t}`;
const vazio: Campo = { texto: "", fonte: "nao_encontrado", trecho: "", motivo: "" };
const daPagina = (texto: string, trecho: string): ItemLista => ({ texto: S(texto), fonte: "pagina", trecho, motivo: "" });
const corte = (t: string, n = 160) => (t.length > n ? t.slice(0, n) : t);
const semMarcador = (l: string) => l.replace(/^(?:#{1,4}|-)\s+/, "");

export function criarProvedorSimulado(cenario: CenarioSimulado = "normal"): ProvedorAnalise {
  return {
    modo: "simulado",
    async analisar(pedido: PedidoAnalise): Promise<RespostaProvedor> {
      if (cenario === "recusa") throw new ErroAnalise("ia_recusou");
      if (cenario === "incompleta") throw new ErroAnalise("ia_resposta_incompleta");
      if (cenario === "indisponivel") throw new ErroAnalise("ia_indisponivel");
      const conteudo = cenario === "formato_invalido" ? { produto: "formato errado" } : simular(pedido);
      return { conteudo, modelo: MODELO_SIMULADO, uso: null };
    },
  };
}

function simular({ pagina }: PedidoAnalise): RespostaModelo {
  const linhas = pagina.texto.split("\n");
  const titulo = linhas.find((l) => l.startsWith("# "));
  const itensDeLista = linhas.filter((l) => l.startsWith("- ")).map(semMarcador).filter((l) => l.length >= 12);
  const corpo = linhas.filter((l) => !l.startsWith("#"));
  const comBonus = corpo.filter((l) => /b[ôo]nus/i.test(l)).map(semMarcador);
  const comProva = corpo.filter((l) => /depoiment|alunos|clientes|\d+\s?%|\d+\s?mil\b/i.test(l)).map(semMarcador);

  const nome: Campo = pagina.titulo
    ? { ...daPagina(`Título da página: ${corte(pagina.titulo)}`, corte(pagina.titulo)) }
    : vazio;
  const resumo: Campo = pagina.descricao
    ? { ...daPagina(`Descrição da página: ${corte(pagina.descricao)}`, corte(pagina.descricao)) }
    : vazio;
  const preco: Campo = pagina.precos[0] ? daPagina(`Preço escrito na página: ${pagina.precos[0]}`, pagina.precos[0]) : vazio;
  const garantia: Campo = pagina.garantia
    ? daPagina(`Frase sobre garantia: ${corte(pagina.garantia)}`, corte(pagina.garantia.replace(/\.\.\.$/, "")))
    : vazio;
  const principal: Campo = titulo ? daPagina(`Título principal: ${corte(semMarcador(titulo))}`, corte(semMarcador(titulo))) : vazio;

  return {
    produto: {
      nome,
      tipo: vazio,
      resumo,
      preco,
      garantia,
      bonus: comBonus.slice(0, 3).map((l) => daPagina(`Linha que cita bônus: ${corte(l)}`, corte(l))),
    },
    publico: {
      perfis: [
        {
          texto: S("O público só é identificado quando a IA estiver ligada."),
          fonte: "inferencia",
          trecho: "",
          motivo: "Resultado do simulador, sem análise de verdade.",
        },
      ],
      dores: [],
      desejos: [
        {
          texto: S("Item com uma citação inventada, para mostrar que a conferência dos trechos funciona."),
          fonte: "pagina",
          trecho: TRECHO_INVENTADO,
          motivo: "",
        },
      ],
      objecoes: [],
    },
    promessa: {
      principal,
      beneficios: itensDeLista.slice(0, 3).map((l) => daPagina(`Item de lista: ${corte(l)}`, corte(l))),
      mecanismo: vazio,
      prazo: vazio,
    },
    provas: comProva.slice(0, 3).map((l) => ({
      categoria: /depoiment/i.test(l) ? ("depoimento" as const) : ("numero" as const),
      texto: S(`Linha com número ou depoimento: ${corte(l)}`),
      trecho: corte(l),
    })),
    alertas: [{ texto: AVISO_SIMULACAO, severidade: "atencao" }],
    lacunas: [S("Tipo de produto, dores, desejos, objeções, mecanismo e prazo não são gerados sem IA.")],
  };
}
