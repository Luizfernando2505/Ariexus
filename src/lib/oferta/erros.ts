// Erros esperados da análise, cada um com a mensagem que o usuário vê.
// Mensagens dizem o que aconteceu e o que fazer, sem detalhes internos.

export const MENSAGENS = {
  url_invalida: "Essa URL não é válida. Cole o endereço completo da página, começando com https://.",
  url_bloqueada: "Esse endereço não pode ser lido. Use a URL pública da página de vendas.",
  limite_leituras: "Você fez muitas leituras na última hora. Espere um pouco e tente de novo.",
  limite_analises: "Você usou todas as análises do mês no seu plano.",
  pagina_nao_encontrada: "Não encontramos esse site. Confira se o endereço está correto.",
  pagina_inacessivel: "Não conseguimos conectar à página. Ela pode estar fora do ar.",
  tempo_esgotado: "A página demorou demais para responder. Tente de novo em alguns minutos.",
  pagina_recusou: "O site recusou a leitura automática. Tente outra URL da mesma oferta.",
  pagina_erro_http: "A página respondeu com erro. Confira se o endereço abre no navegador.",
  pagina_erro_servidor: "O site da oferta está com erro no momento. Tente de novo mais tarde.",
  redirecionamentos_demais: "A página redireciona muitas vezes. Cole o endereço final, o que aparece no navegador.",
  nao_e_html: "Esse endereço não é uma página da web (pode ser um arquivo ou imagem).",
  conteudo_insuficiente: "A página tem pouco texto para uma análise confiável.",
  pagina_dinamica: "A página só mostra o conteúdo depois de carregar no navegador, e ainda não conseguimos ler esse tipo de página.",
  ia_indisponivel: "O serviço de análise não respondeu. Tente de novo em alguns minutos.",
  ia_recusou: "O serviço de análise não aceitou analisar essa página.",
  ia_resposta_incompleta: "A análise veio incompleta. Tente de novo.",
  ia_resposta_invalida: "A análise veio num formato inesperado e foi descartada. Tente de novo.",
  erro_interno: "Algo deu errado do nosso lado. Tente de novo.",
} as const;

export type CodigoErro = keyof typeof MENSAGENS;

export class ErroAnalise extends Error {
  constructor(
    readonly codigo: CodigoErro,
    readonly detalhe?: string,
  ) {
    super(MENSAGENS[codigo]);
    this.name = "ErroAnalise";
  }

  // Texto final para a tela: a mensagem fixa e, quando ajuda, um detalhe curto (ex.: "erro 404").
  get paraUsuario(): string {
    return this.detalhe ? `${this.message} (${this.detalhe})` : this.message;
  }
}
