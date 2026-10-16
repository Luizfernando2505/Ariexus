// Extração do texto útil da página.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contarPalavras, extrairConteudo } from "../src/lib/oferta/extrair";

const fixture = (nome: string) => readFileSync(new URL(`./fixtures/${nome}`, import.meta.url), "utf8");

describe("extrairConteudo numa página de vendas", () => {
  const c = extrairConteudo(fixture("pagina-vendas.html"));

  it("lê título, descrição e idioma", () => {
    expect(c.titulo).toBe("Fotografia no Celular | Curso Online");
    expect(c.descricao).toBe("Aprenda a tirar fotos profissionais usando só o seu celular, em aulas curtas e práticas.");
    expect(c.idioma).toBe("pt-BR");
  });

  it("mantém títulos, listas, botões e texto alternativo de imagens", () => {
    expect(c.texto).toContain("# Fotos profissionais com o celular que você já tem");
    expect(c.texto).toContain("## O que você vai aprender");
    expect(c.texto).toContain("- Bônus 1: Guia de poses para fotos de produto em PDF");
    expect(c.texto).toContain("Garantir minha vaga");
    expect(c.texto).toContain("[imagem: Aluna fotografando um bolo com o celular]");
  });

  it("ignora scripts, estilos, svg, noscript e elementos escondidos", () => {
    for (const fora of ["dataLayer", "rastreamento", "margin: 0", "texto de svg", "Ative o JavaScript", "Texto escondido", "Ícone decorativo"]) {
      expect(c.texto).not.toContain(fora);
    }
  });

  it("corta botões repetidos", () => {
    expect(c.texto.match(/Quero aprender agora/g)).toHaveLength(2);
  });

  it("encontra preços e a frase de garantia", () => {
    expect(c.precos).toEqual(["R$ 397,00", "R$ 197,00", "R$ 19,70"]);
    expect(c.garantia).toBe("Garantia incondicional de 7 dias: se não gostar, devolvemos 100% do seu dinheiro.");
  });

  it("conta palavras e imagens", () => {
    expect(c.palavras).toBeGreaterThan(300);
    expect(c.imagens).toBe(4);
    expect(c.imagensComDescricao).toBe(1);
    expect(c.pareceDinamica).toBe(false);
    expect(c.truncado).toBe(false);
  });
});

describe("extrairConteudo em páginas difíceis", () => {
  it("reconhece página montada por JavaScript", () => {
    const c = extrairConteudo(fixture("spa.html"));
    expect(c.palavras).toBe(0);
    expect(c.pareceDinamica).toBe(true);
  });

  it("reconhece página com pouco texto que não é de JavaScript", () => {
    const c = extrairConteudo(fixture("curta.html"));
    expect(c.palavras).toBeLessThan(150);
    expect(c.pareceDinamica).toBe(false);
  });

  it("corta texto longo numa quebra de linha e marca como truncado", () => {
    const html = `<html><body>${Array.from({ length: 400 }, (_, i) => `<p>Parágrafo número ${i} com algum texto de venda.</p>`).join("")}</body></html>`;
    const c = extrairConteudo(html, 2000);
    expect(c.truncado).toBe(true);
    expect(c.texto.length).toBeLessThanOrEqual(2000);
    expect(c.texto.endsWith("venda.")).toBe(true);
  });

  it("aguenta HTML mal formado e entidades", () => {
    const c = extrairConteudo("<div><p>Preço: R&#36; 47 &amp; frete grátis<div><b>sem fechar<script>alert(1)");
    expect(c.texto).toContain("Preço: R$ 47 & frete grátis");
    expect(c.texto).toContain("sem fechar");
    expect(c.texto).not.toContain("alert");
    expect(c.precos).toEqual(["R$ 47"]);
  });

  it("não pega título nem item de menu como garantia", () => {
    const c = extrairConteudo("<nav><a>Garantia</a></nav><h2>Garantia</h2><p>Você tem 30 dias de garantia total para testar o método.</p>");
    expect(c.garantia).toBe("Você tem 30 dias de garantia total para testar o método.");
  });
});

describe("contarPalavras", () => {
  it("conta palavras com acento, hífen e números", () => {
    expect(contarPalavras("Ação rápida: guarda-chuva por R$ 97,00!")).toBe(7);
  });
});
