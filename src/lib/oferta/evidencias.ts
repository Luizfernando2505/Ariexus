import type { ConteudoPagina } from "./extrair";
import { campoParaItem, type Alerta, type Analise, type Item, type RespostaModelo } from "./schema";

// Confere, no nosso servidor, cada trecho que o modelo diz ter tirado da página.
// O que não for encontrado no texto lido deixa de ser apresentado como fato.

export const MOTIVO_REBAIXADO = "O trecho citado não foi encontrado na página, por isso o item é tratado como inferência.";
export const MOTIVO_AUSENTE = "Sem motivo informado.";

/** Texto comparável: sem diferença de maiúsculas, aspas, travessões, espaços ou marcadores de título e lista. */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFKC")
    .toLowerCase()
    .replace(/^\s*(?:#{1,4}|-)\s+/gm, "")
    .replace(/[‘’‚‛“”„‟«»"'`´]/g, "")
    .replace(/[‐-―−]/g, "-")
    .replace(/…/g, "...")
    .replace(/\s+/g, " ")
    .trim();
}

export type Verificador = (trecho: string) => boolean;

/** Cria o verificador para uma página. Aceita trechos com reticências no meio, desde que cada parte esteja na página, em ordem. */
export function criarVerificador(pagina: Pick<ConteudoPagina, "titulo" | "descricao" | "texto">): Verificador {
  const base = normalizar([pagina.titulo ?? "", pagina.descricao ?? "", pagina.texto].join("\n"));
  return (trecho) => {
    const partes = normalizar(trecho)
      .split("...")
      .map((p) => p.replace(/^[\s.,;:!?]+|[\s.,;:!?]+$/g, ""))
      .filter(Boolean);
    if (!partes.length || partes.join("").replace(/[^\p{L}\p{N}]/gu, "").length < 3) return false;
    let desde = 0;
    for (const parte of partes) {
      const i = base.indexOf(parte, desde);
      if (i < 0) return false;
      desde = i + parte.length;
    }
    return true;
  };
}

type Contagem = Analise["cobertura"];

function conferirItem(item: Item, existe: Verificador, c: Contagem): Item {
  if (item.fonte === "pagina") {
    if (existe(item.trecho)) {
      c.pagina++;
      return { ...item, motivo: "" };
    }
    c.rebaixados++;
    c.inferencia++;
    return { ...item, fonte: "inferencia", trecho: "", motivo: MOTIVO_REBAIXADO };
  }
  c.inferencia++;
  return { ...item, trecho: "", motivo: item.motivo.trim() || MOTIVO_AUSENTE };
}

/** Transforma a resposta do modelo no formato salvo, conferindo cada citação contra a página. */
export function verificarAnalise(resposta: RespostaModelo, pagina: ConteudoPagina): Analise {
  const existe = criarVerificador(pagina);
  const c: Contagem = { pagina: 0, inferencia: 0, vazios: 0, rebaixados: 0, provasDescartadas: 0 };

  const campo = (valor: RespostaModelo["produto"]["nome"]) => {
    const item = campoParaItem(valor);
    if (!item) {
      c.vazios++;
      return null;
    }
    return conferirItem(item, existe, c);
  };
  const lista = (itens: RespostaModelo["produto"]["bonus"]) =>
    itens.filter((i) => i.texto.trim()).map((i) => conferirItem(i, existe, c));

  const r = resposta;
  const produto = {
    nome: campo(r.produto.nome),
    tipo: campo(r.produto.tipo),
    resumo: campo(r.produto.resumo),
    preco: campo(r.produto.preco),
    garantia: campo(r.produto.garantia),
    bonus: lista(r.produto.bonus),
  };
  const publico = {
    perfis: lista(r.publico.perfis),
    dores: lista(r.publico.dores),
    desejos: lista(r.publico.desejos),
    objecoes: lista(r.publico.objecoes),
  };
  const promessa = {
    principal: campo(r.promessa.principal),
    beneficios: lista(r.promessa.beneficios),
    mecanismo: campo(r.promessa.mecanismo),
    prazo: campo(r.promessa.prazo),
  };

  // Prova sem trecho na página não é prova: sai da lista.
  const provas = r.provas.filter((p) => {
    const ok = p.texto.trim() && existe(p.trecho);
    if (!ok) c.provasDescartadas++;
    return ok;
  });

  const alertas: Alerta[] = r.alertas.filter((a) => a.texto.trim()).map((a) => ({ ...a, origem: "modelo" }));
  if (c.rebaixados) {
    alertas.unshift({
      origem: "sistema",
      severidade: "atencao",
      texto: `${c.rebaixados} ${c.rebaixados === 1 ? "item citava um trecho que não está" : "itens citavam trechos que não estão"} na página e ${c.rebaixados === 1 ? "passou" : "passaram"} a ser ${c.rebaixados === 1 ? "tratado" : "tratados"} como inferência.`,
    });
  }
  if (c.provasDescartadas) {
    alertas.unshift({
      origem: "sistema",
      severidade: "atencao",
      texto: `${c.provasDescartadas} ${c.provasDescartadas === 1 ? "prova citada não foi encontrada" : "provas citadas não foram encontradas"} na página e ${c.provasDescartadas === 1 ? "foi descartada" : "foram descartadas"}.`,
    });
  }

  return {
    produto,
    publico,
    promessa,
    provas,
    alertas,
    lacunas: r.lacunas.map((l) => l.trim()).filter(Boolean),
    cobertura: c,
  };
}

/** Avisos sobre a leitura da página, que valem com ou sem IA. */
export function avisosDaLeitura(pagina: ConteudoPagina, cortadaNoDownload: boolean): string[] {
  const avisos: string[] = [];
  if (cortadaNoDownload) avisos.push("A página é muito grande e foi lida só até 2 MB. O final pode ter ficado de fora.");
  if (pagina.truncado) avisos.push("O texto da página passou de 60 mil caracteres e só o início foi usado.");
  const semDescricao = pagina.imagens - pagina.imagensComDescricao;
  if (semDescricao >= 3) {
    avisos.push(
      `A página tem ${semDescricao} imagens sem descrição. Preços, depoimentos e provas que estejam dentro de imagens não foram lidos.`,
    );
  }
  return avisos;
}
