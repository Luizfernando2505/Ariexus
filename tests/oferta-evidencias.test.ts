// Conferência dos trechos citados: o que não está na página não pode aparecer como fato.
import { describe, expect, it } from "vitest";
import { avisosDaLeitura, criarVerificador, MOTIVO_AUSENTE, MOTIVO_REBAIXADO, verificarAnalise } from "../src/lib/oferta/evidencias";
import { extrairConteudo } from "../src/lib/oferta/extrair";
import type { RespostaModelo } from "../src/lib/oferta/schema";

const pagina = extrairConteudo(`
  <html><head><title>Método Horta em Casa</title><meta name="description" content="Aprenda a plantar em apartamento."></head>
  <body>
    <h1>Colha verduras na sua varanda em 30 dias</h1>
    <ul><li>Mais de 2.000 alunos já começaram a horta</li></ul>
    <p>“Minha horta mudou minha alimentação”, diz a aluna Rita.</p>
    <p>Garantia de 7 dias ou seu dinheiro de volta.</p>
  </body></html>`);

describe("criarVerificador", () => {
  const existe = criarVerificador(pagina);

  it("acha trechos exatos, inclusive no título e na descrição", () => {
    expect(existe("Colha verduras na sua varanda em 30 dias")).toBe(true);
    expect(existe("Método Horta em Casa")).toBe(true);
    expect(existe("Aprenda a plantar em apartamento.")).toBe(true);
  });

  it("tolera maiúsculas, aspas, espaços, marcadores e pontuação nas pontas", () => {
    expect(existe("  colha VERDURAS na sua   varanda  ")).toBe(true);
    expect(existe('"Minha horta mudou minha alimentação"')).toBe(true);
    expect(existe("- Mais de 2.000 alunos já começaram a horta.")).toBe(true);
  });

  it("aceita reticências quando as partes aparecem em ordem", () => {
    expect(existe("Colha verduras... em 30 dias")).toBe(true);
    expect(existe("em 30 dias … Colha verduras")).toBe(false);
  });

  it("recusa trechos inventados, alterados ou curtos demais", () => {
    expect(existe("Colha verduras na sua varanda em 15 dias")).toBe(false);
    expect(existe("Mais de 5.000 alunos")).toBe(false);
    expect(existe("")).toBe(false);
    expect(existe("a")).toBe(false);
    expect(existe("...")).toBe(false);
  });
});

const vazio = { texto: "", fonte: "nao_encontrado" as const, trecho: "", motivo: "" };

function resposta(parcial: Partial<RespostaModelo> = {}): RespostaModelo {
  return {
    produto: { nome: vazio, tipo: vazio, resumo: vazio, preco: vazio, garantia: vazio, bonus: [] },
    publico: { perfis: [], dores: [], desejos: [], objecoes: [] },
    promessa: { principal: vazio, beneficios: [], mecanismo: vazio, prazo: vazio },
    provas: [],
    alertas: [],
    lacunas: [],
    ...parcial,
  };
}

describe("verificarAnalise", () => {
  it("mantém o que está na página e rebaixa citação inventada para inferência", () => {
    const r = verificarAnalise(
      resposta({
        produto: {
          ...resposta().produto,
          nome: { texto: "Método Horta em Casa", fonte: "pagina", trecho: "Método Horta em Casa", motivo: "" },
          preco: { texto: "R$ 97", fonte: "pagina", trecho: "por apenas R$ 97", motivo: "" },
        },
        promessa: {
          ...resposta().promessa,
          prazo: { texto: "30 dias", fonte: "pagina", trecho: "em 30 dias", motivo: "lixo" },
        },
      }),
      pagina,
    );
    expect(r.produto.nome).toEqual({ texto: "Método Horta em Casa", fonte: "pagina", trecho: "Método Horta em Casa", motivo: "" });
    expect(r.produto.preco).toEqual({ texto: "R$ 97", fonte: "inferencia", trecho: "", motivo: MOTIVO_REBAIXADO });
    expect(r.promessa.prazo?.motivo).toBe("");
    expect(r.cobertura).toMatchObject({ pagina: 2, inferencia: 1, rebaixados: 1 });
    expect(r.alertas[0]).toMatchObject({ origem: "sistema", severidade: "atencao" });
    expect(r.alertas[0].texto).toContain("1 item citava um trecho que não está na página");
  });

  it("deixa vazio o que o modelo não encontrou, e não inventa preenchimento", () => {
    const r = verificarAnalise(resposta({ lacunas: ["  Preço não informado  ", " "] }), pagina);
    expect(r.produto.nome).toBeNull();
    expect(r.produto.preco).toBeNull();
    expect(r.promessa.principal).toBeNull();
    expect(r.cobertura.vazios).toBe(8);
    expect(r.lacunas).toEqual(["Preço não informado"]);
  });

  it("trata campo marcado como encontrado mas sem texto como vazio", () => {
    const r = verificarAnalise(
      resposta({ produto: { ...resposta().produto, tipo: { texto: "  ", fonte: "inferencia", trecho: "", motivo: "x" } } }),
      pagina,
    );
    expect(r.produto.tipo).toBeNull();
  });

  it("guarda o motivo das inferências e limpa trechos que não se aplicam", () => {
    const r = verificarAnalise(
      resposta({
        publico: {
          perfis: [{ texto: "Moradores de apartamento", fonte: "inferencia", trecho: "algo", motivo: "A página fala de varanda." }],
          dores: [{ texto: "Comida cara", fonte: "inferencia", trecho: "", motivo: "" }],
          desejos: [],
          objecoes: [],
        },
      }),
      pagina,
    );
    expect(r.publico.perfis[0]).toEqual({ texto: "Moradores de apartamento", fonte: "inferencia", trecho: "", motivo: "A página fala de varanda." });
    expect(r.publico.dores[0].motivo).toBe(MOTIVO_AUSENTE);
  });

  it("descarta provas que não estão na página", () => {
    const r = verificarAnalise(
      resposta({
        provas: [
          { categoria: "numero", texto: "2.000 alunos", trecho: "Mais de 2.000 alunos já começaram a horta" },
          { categoria: "depoimento", texto: "Depoimento inventado", trecho: "Ganhei 10 mil reais no primeiro mês" },
        ],
      }),
      pagina,
    );
    expect(r.provas.map((p) => p.texto)).toEqual(["2.000 alunos"]);
    expect(r.cobertura.provasDescartadas).toBe(1);
    expect(r.alertas.some((a) => a.texto.includes("1 prova citada não foi encontrada"))).toBe(true);
  });

  it("marca a origem dos alertas do modelo", () => {
    const r = verificarAnalise(resposta({ alertas: [{ texto: "Promessa de prazo exato.", severidade: "info" }] }), pagina);
    expect(r.alertas).toEqual([{ texto: "Promessa de prazo exato.", severidade: "info", origem: "modelo" }]);
  });
});

describe("avisosDaLeitura", () => {
  it("avisa sobre corte e imagens sem descrição", () => {
    const base = extrairConteudo("<p>texto</p>");
    expect(avisosDaLeitura(base, false)).toEqual([]);
    const avisos = avisosDaLeitura({ ...base, truncado: true, imagens: 5, imagensComDescricao: 1 }, true);
    expect(avisos).toHaveLength(3);
    expect(avisos[2]).toContain("4 imagens sem descrição");
  });
});
