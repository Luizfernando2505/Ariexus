import * as z from "zod/v4";

// Formato fixo da análise. O mesmo esquema vira o JSON Schema enviado ao modelo
// e valida a resposta no servidor antes de salvar.
// Sem uniões (anyOf) de propósito: a saída estruturada da API limita o número de uniões,
// e "não encontrado" fica como um valor de `fonte` em vez de null.

export const MAX_ITENS = 8;
export const MAX_TEXTO = 500;

const texto = (descricao: string) => z.string().max(MAX_TEXTO).describe(descricao);

const TRECHO = "Quando fonte = pagina: cópia exata, palavra por palavra, de um trecho curto da página que comprova o item. Senão, vazio.";
const MOTIVO = "Quando fonte = inferencia: por que o item foi deduzido, já que não está escrito na página. Senão, vazio.";

/** Item de uma lista: sempre tem base, escrita na página ou deduzida. */
const ItemModelo = z.object({
  texto: texto("O item, em uma frase curta."),
  fonte: z.enum(["pagina", "inferencia"]).describe("pagina: está escrito na página. inferencia: deduzido, não está escrito."),
  trecho: texto(TRECHO),
  motivo: texto(MOTIVO),
});

/** Campo único: pode não ter base nenhuma na página. */
const campo = (descricao: string) =>
  z
    .object({
      texto: texto(descricao),
      fonte: z
        .enum(["pagina", "inferencia", "nao_encontrado"])
        .describe("pagina: está escrito na página. inferencia: deduzido. nao_encontrado: a página não dá base; deixe texto, trecho e motivo vazios."),
      trecho: texto(TRECHO),
      motivo: texto(MOTIVO),
    })
    .describe(descricao);

const lista = (descricao: string) => z.array(ItemModelo).max(MAX_ITENS).describe(descricao);

export const CATEGORIAS_PROVA = [
  "depoimento",
  "numero",
  "autoridade",
  "garantia",
  "demonstracao",
  "midia",
  "certificacao",
  "outra",
] as const;

/** O que o modelo devolve. */
export const RespostaModelo = z.object({
  produto: z.object({
    nome: campo("Nome do produto."),
    tipo: campo("Tipo de produto (curso online, e-book, mentoria, suplemento, software...)."),
    resumo: campo("O que o comprador recebe, em uma frase."),
    preco: campo("Preço e condições de pagamento escritos na página."),
    garantia: campo("Garantia oferecida."),
    bonus: lista("Bônus prometidos na página."),
  }),
  publico: z.object({
    perfis: lista("Quem é o comprador provável."),
    dores: lista("Problemas que a página diz resolver."),
    desejos: lista("Resultados que o comprador quer."),
    objecoes: lista("Dúvidas ou receios que a página tenta responder."),
  }),
  promessa: z.object({
    principal: campo("A grande promessa da oferta."),
    beneficios: lista("Benefícios citados."),
    mecanismo: campo("Como o produto diz entregar o resultado (método, ingrediente, tecnologia)."),
    prazo: campo("Prazo prometido para o resultado."),
  }),
  provas: z
    .array(
      z.object({
        categoria: z.enum(CATEGORIAS_PROVA),
        texto: texto("A prova, em uma frase curta."),
        trecho: texto("Cópia exata do trecho da página que mostra a prova."),
      }),
    )
    .max(MAX_ITENS)
    .describe("Provas que a página apresenta. Só o que está escrito na página, nunca inferido."),
  alertas: z
    .array(
      z.object({
        texto: texto("O ponto de atenção, em uma ou duas frases."),
        severidade: z.enum(["info", "atencao"]),
      }),
    )
    .max(MAX_ITENS)
    .describe(
      "Pontos de atenção para anunciar a oferta: promessas que costumam violar as políticas do Google Ads e do Meta Ads, contradições, informação importante ausente.",
    ),
  lacunas: z
    .array(texto("Uma lacuna."))
    .max(MAX_ITENS)
    .describe("O que a análise não conseguiu determinar a partir da página."),
});

export type RespostaModelo = z.infer<typeof RespostaModelo>;
type CampoModelo = RespostaModelo["produto"]["nome"];

// ---------- Formato salvo e mostrado na tela, depois da conferência ----------
// Também valida o que é lido do banco antes de mostrar: uma linha fora do formato não quebra a tela.

export const Item = z.object({
  texto: z.string(),
  fonte: z.enum(["pagina", "inferencia"]),
  /** Trecho da página (fonte = pagina). */
  trecho: z.string(),
  /** Motivo da inferência (fonte = inferencia). */
  motivo: z.string(),
});

const Prova = z.object({ categoria: z.enum(CATEGORIAS_PROVA), texto: z.string(), trecho: z.string() });
const Alerta = z.object({ texto: z.string(), severidade: z.enum(["info", "atencao"]), origem: z.enum(["modelo", "sistema"]) });

export const Analise = z.object({
  produto: z.object({
    nome: Item.nullable(),
    tipo: Item.nullable(),
    resumo: Item.nullable(),
    preco: Item.nullable(),
    garantia: Item.nullable(),
    bonus: z.array(Item),
  }),
  publico: z.object({ perfis: z.array(Item), dores: z.array(Item), desejos: z.array(Item), objecoes: z.array(Item) }),
  promessa: z.object({ principal: Item.nullable(), beneficios: z.array(Item), mecanismo: Item.nullable(), prazo: Item.nullable() }),
  provas: z.array(Prova),
  alertas: z.array(Alerta),
  lacunas: z.array(z.string()),
  /** Quantos itens vieram da página, quantos foram deduzidos e quantos campos ficaram vazios. */
  cobertura: z.object({
    pagina: z.number(),
    inferencia: z.number(),
    vazios: z.number(),
    rebaixados: z.number(),
    provasDescartadas: z.number(),
  }),
});

/** O que fica salvo da página lida (sem o HTML). */
export const PaginaSalva = z.object({
  titulo: z.string().nullable(),
  descricao: z.string().nullable(),
  idioma: z.string().nullable(),
  palavras: z.number(),
  truncado: z.boolean(),
  imagens: z.number(),
  imagensComDescricao: z.number(),
  precos: z.array(z.string()),
  garantia: z.string().nullable(),
  pareceDinamica: z.boolean(),
  status: z.number(),
  bytes: z.number(),
  cortada: z.boolean(),
  avisos: z.array(z.string()),
});

export type Item = z.infer<typeof Item>;
export type Prova = z.infer<typeof Prova>;
export type Alerta = z.infer<typeof Alerta>;
export type Analise = z.infer<typeof Analise>;
export type PaginaSalva = z.infer<typeof PaginaSalva>;

export function campoParaItem(c: CampoModelo): Item | null {
  if (c.fonte === "nao_encontrado" || !c.texto.trim()) return null;
  return { texto: c.texto, fonte: c.fonte, trecho: c.trecho, motivo: c.motivo };
}

// ---------- JSON Schema para a API ----------

/**
 * Converte o esquema para o subconjunto de JSON Schema aceito pela saída estruturada da API:
 * mantém enum e const (o helper do SDK os transforma em descrição) e move os limites de tamanho,
 * que a API não aceita, para a descrição. O servidor confere os limites depois.
 */
export function esquemaJsonParaApi(): Record<string, unknown> {
  const bruto = z.toJSONSchema(RespostaModelo, { reused: "inline" }) as Record<string, unknown>;
  delete bruto.$schema;
  return adaptar(bruto) as Record<string, unknown>;
}

function adaptar(no: unknown): unknown {
  if (Array.isArray(no)) return no.map(adaptar);
  if (!no || typeof no !== "object") return no;
  const saida: Record<string, unknown> = {};
  const notas: string[] = [];
  for (const [chave, valor] of Object.entries(no)) {
    if (chave === "maxLength") notas.push(`até ${valor} caracteres`);
    else if (chave === "maxItems") notas.push(`até ${valor} itens`);
    else if (chave === "minItems" && valor !== 0 && valor !== 1) notas.push(`pelo menos ${valor} itens`);
    else saida[chave] = adaptar(valor);
  }
  if (saida.type === "object") saida.additionalProperties = false;
  if (notas.length) saida.description = [saida.description, `(${notas.join(", ")})`].filter(Boolean).join(" ");
  return saida;
}

const CAMPOS_ENUM = new Set(["fonte", "categoria", "severidade"]);

/**
 * Ajusta a resposta antes de validar: corta listas e textos longos (uma resposta com 9 itens
 * ou uma frase comprida não deve ser descartada inteira) e põe os valores de enum em minúsculas,
 * porque a API não garante a caixa deles. O resto do formato precisa bater exatamente.
 */
export function prepararResposta(valor: unknown): unknown {
  if (typeof valor === "string") return valor.length > MAX_TEXTO ? `${valor.slice(0, MAX_TEXTO - 3)}...` : valor;
  if (Array.isArray(valor)) return valor.slice(0, MAX_ITENS).map(prepararResposta);
  if (valor && typeof valor === "object") {
    return Object.fromEntries(
      Object.entries(valor).map(([k, v]) => [
        k,
        CAMPOS_ENUM.has(k) && typeof v === "string" ? v.trim().toLowerCase() : prepararResposta(v),
      ]),
    );
  }
  return valor;
}
