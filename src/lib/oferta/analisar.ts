import type { DadosOferta } from "./entrada";
import { ErroAnalise } from "./erros";
import { avisosDaLeitura, verificarAnalise } from "./evidencias";
import { extrairConteudo, MINIMO_PALAVRAS } from "./extrair";
import type { PaginaBaixada } from "./ler-pagina";
import type { ModoAnalise, ProvedorAnalise, UsoModelo } from "./provedores/tipos";
import { prepararResposta, RespostaModelo, type Analise, type PaginaSalva } from "./schema";
import { validarUrlOferta, type OpcoesUrl } from "./url";

// A análise de ponta a ponta, sem saber de banco, de tela ou de qual IA responde.
// Cada etapa que pode falhar para antes de gastar com a próxima.

export type ResultadoUso = { permitido: boolean; usados: number; limite: number };

export type Dependencias = {
  /** Registra o uso e diz se está dentro do limite (no banco: registrar_uso). */
  registrarUso(tipo: "leitura" | "analise"): Promise<ResultadoUso>;
  lerPagina(url: URL): Promise<PaginaBaixada>;
  /** null quando a IA está desligada: a página é lida e mostrada, sem análise. */
  provedor: ProvedorAnalise | null;
  opcoesUrl?: OpcoesUrl;
};

type Base = { url: string; urlFinal: string; pagina: PaginaSalva; texto: string };

export type ResultadoAnalise =
  | (Base & { status: "somente_leitura"; modo: "desligado" })
  | (Base & {
      status: "concluida";
      modo: Exclude<ModoAnalise, "desligado">;
      analise: Analise;
      modelo: string;
      uso: UsoModelo | null;
    });

export async function analisarOferta(dados: DadosOferta, deps: Dependencias): Promise<ResultadoAnalise> {
  const url = validarUrlOferta(dados.url, undefined, deps.opcoesUrl);

  const leitura = await deps.registrarUso("leitura");
  if (!leitura.permitido) throw new ErroAnalise("limite_leituras", `limite de ${leitura.limite} por hora`);

  const baixada = await deps.lerPagina(url);
  const conteudo = extrairConteudo(baixada.html);
  if (conteudo.palavras < MINIMO_PALAVRAS) {
    if (conteudo.pareceDinamica) throw new ErroAnalise("pagina_dinamica");
    throw new ErroAnalise("conteudo_insuficiente", `${conteudo.palavras} palavras, o mínimo é ${MINIMO_PALAVRAS}`);
  }

  const { texto, ...resto } = conteudo;
  const base: Base = {
    url: url.href,
    urlFinal: baixada.urlFinal.href,
    pagina: { ...resto, status: baixada.status, bytes: baixada.bytes, cortada: baixada.cortada, avisos: avisosDaLeitura(conteudo, baixada.cortada) },
    texto,
  };

  if (!deps.provedor) return { ...base, status: "somente_leitura", modo: "desligado" };

  // A cota de análises só é gasta quando a página passou em todas as etapas anteriores.
  const cota = await deps.registrarUso("analise");
  if (!cota.permitido) throw new ErroAnalise("limite_analises", `${cota.usados} de ${cota.limite} neste mês`);

  let resposta;
  try {
    resposta = await deps.provedor.analisar({ url: base.urlFinal, pagina: conteudo, dados });
  } catch (erro) {
    if (erro instanceof ErroAnalise) throw erro;
    console.error("[analise] falha inesperada no provedor", { tipo: (erro as Error)?.name });
    throw new ErroAnalise("ia_indisponivel");
  }

  const validada = RespostaModelo.safeParse(prepararResposta(resposta.conteudo));
  if (!validada.success) {
    console.error("[analise] resposta fora do formato", {
      problemas: validada.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.code}`),
    });
    throw new ErroAnalise("ia_resposta_invalida");
  }

  return {
    ...base,
    status: "concluida",
    modo: deps.provedor.modo,
    analise: verificarAnalise(validada.data, conteudo),
    modelo: resposta.modelo,
    uso: resposta.uso,
  };
}
