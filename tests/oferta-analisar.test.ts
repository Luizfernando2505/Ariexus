// A análise de ponta a ponta com dependências falsas: ordem das etapas, limites, erros e simulador.
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { analisarOferta, type Dependencias } from "../src/lib/oferta/analisar";
import type { DadosOferta } from "../src/lib/oferta/entrada";
import { ErroAnalise } from "../src/lib/oferta/erros";
import { criarProvedor, modoAnalise } from "../src/lib/oferta/provedores";
import { AVISO_SIMULACAO, criarProvedorSimulado, type CenarioSimulado } from "../src/lib/oferta/provedores/simulado";
import type { ProvedorAnalise } from "../src/lib/oferta/provedores/tipos";
import type { RespostaModelo } from "../src/lib/oferta/schema";

const HTML = readFileSync(new URL("./fixtures/pagina-vendas.html", import.meta.url), "utf8");
const dados: DadosOferta = { url: "https://exemplo.com.br/curso", perfil: "afiliado", plataforma: "Hotmart", pais: "BR", idioma: "pt-BR" };

function deps(extra: Partial<Dependencias> = {}, html = HTML) {
  const usos: string[] = [];
  const d: Dependencias = {
    registrarUso: vi.fn(async (tipo) => {
      usos.push(tipo);
      return { permitido: true, usados: 1, limite: 10 };
    }),
    lerPagina: vi.fn(async (url: URL) => ({ urlFinal: new URL(url.href + "?final"), html, status: 200, bytes: html.length, cortada: false })),
    provedor: criarProvedorSimulado(),
    ...extra,
  };
  return { d, usos };
}

async function codigo(promessa: Promise<unknown>) {
  try {
    await promessa;
    return null;
  } catch (e) {
    return e instanceof ErroAnalise ? e.codigo : `outro: ${(e as Error).message}`;
  }
}

describe("analisarOferta", () => {
  it("lê, extrai, analisa com o simulador e confere os trechos", async () => {
    const { d, usos } = deps();
    const r = await analisarOferta(dados, d);
    expect(usos).toEqual(["leitura", "analise"]);
    expect(r.status).toBe("concluida");
    if (r.status !== "concluida") return;
    expect(r.modo).toBe("simulado");
    expect(r.modelo).toBe("simulador");
    expect(r.uso).toBeNull();
    expect(r.urlFinal).toBe("https://exemplo.com.br/curso?final");
    expect(r.pagina.titulo).toBe("Fotografia no Celular | Curso Online");
    expect(r.texto).toContain("# Fotos profissionais com o celular que você já tem");
    expect(r.analise.produto.preco).toMatchObject({ fonte: "pagina", trecho: "R$ 397,00" });
    // O simulador inclui de propósito uma citação inventada: ela precisa ser rebaixada.
    expect(r.analise.publico.desejos[0]).toMatchObject({ fonte: "inferencia" });
    expect(r.analise.cobertura.rebaixados).toBe(1);
    expect(r.analise.alertas.some((a) => a.texto === AVISO_SIMULACAO)).toBe(true);
    // Tudo o que o simulador escreve vem marcado.
    const textos = [r.analise.produto.nome, ...r.analise.promessa.beneficios].map((i) => i?.texto ?? "");
    expect(textos.every((t) => t.startsWith("[Simulação]"))).toBe(true);
  });

  it("com a IA desligada, só lê a página e não gasta a cota de análises", async () => {
    const { d, usos } = deps({ provedor: null });
    const r = await analisarOferta(dados, d);
    expect(r.status).toBe("somente_leitura");
    expect(r.modo).toBe("desligado");
    expect(usos).toEqual(["leitura"]);
    expect(r.pagina.precos).toContain("R$ 197,00");
  });

  it("recusa URL inválida ou interna antes de gastar qualquer coisa", async () => {
    for (const [url, esperado] of [
      ["não é url", "url_invalida"],
      ["http://169.254.169.254/", "url_bloqueada"],
      ["http://localhost:3000", "url_bloqueada"],
      ["localhost:3000", "url_invalida"],
    ]) {
      const { d, usos } = deps();
      expect(await codigo(analisarOferta({ ...dados, url }, d))).toBe(esperado);
      expect(usos).toEqual([]);
      expect(d.lerPagina).not.toHaveBeenCalled();
    }
  });

  it("para no limite de leituras por hora sem ler a página", async () => {
    const { d } = deps({ registrarUso: async () => ({ permitido: false, usados: 30, limite: 30 }) });
    expect(await codigo(analisarOferta(dados, d))).toBe("limite_leituras");
    expect(d.lerPagina).not.toHaveBeenCalled();
  });

  it("para no limite de análises do mês sem chamar o provedor", async () => {
    const provedor: ProvedorAnalise = { modo: "simulado", analisar: vi.fn() };
    const { d } = deps({
      provedor,
      registrarUso: async (tipo) => ({ permitido: tipo === "leitura", usados: 10, limite: 10 }),
    });
    const erro = await analisarOferta(dados, d).catch((e) => e);
    expect(erro).toBeInstanceOf(ErroAnalise);
    expect(erro.codigo).toBe("limite_analises");
    expect(erro.paraUsuario).toContain("10 de 10 neste mês");
    expect(provedor.analisar).not.toHaveBeenCalled();
  });

  it("repassa erros da leitura da página", async () => {
    const { d, usos } = deps({ lerPagina: async () => Promise.reject(new ErroAnalise("pagina_recusou", "erro 403")) });
    expect(await codigo(analisarOferta(dados, d))).toBe("pagina_recusou");
    expect(usos).toEqual(["leitura"]);
  });

  it("não chama a IA quando a página tem pouco texto ou depende de JavaScript", async () => {
    const curta = readFileSync(new URL("./fixtures/curta.html", import.meta.url), "utf8");
    const spa = readFileSync(new URL("./fixtures/spa.html", import.meta.url), "utf8");
    const a = deps({}, curta);
    expect(await codigo(analisarOferta(dados, a.d))).toBe("conteudo_insuficiente");
    expect(a.usos).toEqual(["leitura"]);
    const b = deps({}, spa);
    expect(await codigo(analisarOferta(dados, b.d))).toBe("pagina_dinamica");
    expect(b.usos).toEqual(["leitura"]);
  });

  it.each<[CenarioSimulado, string]>([
    ["recusa", "ia_recusou"],
    ["incompleta", "ia_resposta_incompleta"],
    ["indisponivel", "ia_indisponivel"],
    ["formato_invalido", "ia_resposta_invalida"],
  ])("trata falha do modelo: %s", async (cenario, esperado) => {
    const { d } = deps({ provedor: criarProvedorSimulado(cenario) });
    expect(await codigo(analisarOferta(dados, d))).toBe(esperado);
  });

  it("transforma erro desconhecido do provedor em indisponível", async () => {
    const { d } = deps({
      provedor: { modo: "anthropic", analisar: async () => Promise.reject(new TypeError("fetch failed")) },
    });
    expect(await codigo(analisarOferta(dados, d))).toBe("ia_indisponivel");
  });

  it("aceita resposta com listas longas demais e maiúsculas no enum, cortando e ajustando", async () => {
    const simulado = await criarProvedorSimulado().analisar({
      url: dados.url,
      pagina: (await import("../src/lib/oferta/extrair")).extrairConteudo(HTML),
      dados,
    });
    const conteudo = structuredClone(simulado.conteudo) as RespostaModelo;
    conteudo.lacunas = Array.from({ length: 12 }, (_, i) => `Lacuna ${i}`);
    (conteudo.produto.preco as { fonte: string }).fonte = "PAGINA";
    conteudo.produto.nome.texto = "x".repeat(900);
    const { d } = deps({ provedor: { modo: "anthropic", analisar: async () => ({ conteudo, modelo: "m", uso: null }) } });
    const r = await analisarOferta(dados, d);
    if (r.status !== "concluida") throw new Error("esperava análise");
    expect(r.analise.lacunas).toHaveLength(8);
    expect(r.analise.produto.preco?.fonte).toBe("pagina");
    expect(r.analise.produto.nome?.texto.length).toBe(500);
  });
});

describe("modoAnalise e criarProvedor", () => {
  it("fica no simulador fora da produção e desligado em produção", () => {
    expect(modoAnalise({})).toBe("simulado");
    expect(modoAnalise({ VERCEL_ENV: "preview" })).toBe("simulado");
    expect(modoAnalise({ VERCEL_ENV: "production" })).toBe("desligado");
    expect(modoAnalise({ VERCEL_ENV: "production", ANALISE_PROVEDOR: "simulado" })).toBe("desligado");
    expect(modoAnalise({ ANALISE_PROVEDOR: "desligado" })).toBe("desligado");
  });

  it("só liga a Anthropic com o pedido explícito e a chave juntos", () => {
    expect(modoAnalise({ ANTHROPIC_API_KEY: "sk-teste" })).toBe("simulado");
    expect(modoAnalise({ VERCEL_ENV: "production", ANTHROPIC_API_KEY: "sk-teste" })).toBe("desligado");
    expect(modoAnalise({ ANALISE_PROVEDOR: "anthropic" })).toBe("desligado");
    expect(modoAnalise({ ANALISE_PROVEDOR: "anthropic", ANTHROPIC_API_KEY: "sk-teste" })).toBe("anthropic");
  });

  it("cria o provedor certo para cada modo", () => {
    expect(criarProvedor("desligado", {})).toBeNull();
    expect(criarProvedor("simulado", {})?.modo).toBe("simulado");
    expect(criarProvedor("anthropic", {})).toBeNull();
    expect(criarProvedor("anthropic", { ANTHROPIC_API_KEY: "sk-teste" })?.modo).toBe("anthropic");
  });
});
