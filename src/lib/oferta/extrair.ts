import { Parser } from "htmlparser2";

// Transforma o HTML da página em texto limpo, mantendo a estrutura que importa para a análise:
// títulos, parágrafos, listas, botões e o texto alternativo das imagens.

export type ConteudoPagina = {
  titulo: string | null;
  descricao: string | null;
  idioma: string | null;
  /** Texto da página, uma linha por bloco. Títulos marcados com #, itens de lista com -. */
  texto: string;
  palavras: number;
  /** O texto passou do limite e foi cortado no fim. */
  truncado: boolean;
  imagens: number;
  imagensComDescricao: number;
  /** Preços escritos na página (não lê preço dentro de imagem). */
  precos: string[];
  /** Primeira frase da página que fala de garantia (com 6 palavras ou mais), se houver. */
  garantia: string | null;
  /** A página parece montada por JavaScript no navegador (pouco texto e muitos scripts). */
  pareceDinamica: boolean;
};

export const LIMITE_TEXTO = 60_000;
export const MINIMO_PALAVRAS = 150;

const IGNORAR = new Set(["script", "style", "noscript", "template", "svg", "iframe", "canvas", "object", "embed", "select", "option", "head"]);
const BLOCOS = new Set([
  "p", "div", "section", "article", "header", "footer", "main", "aside", "nav", "li", "ul", "ol", "dl", "dt", "dd",
  "h1", "h2", "h3", "h4", "h5", "h6", "br", "hr", "tr", "td", "th", "table", "blockquote", "figure", "figcaption",
  "form", "button", "label", "summary", "details", "address", "pre",
]);
const VAZIOS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const MARCADOR: Record<string, string> = { h1: "# ", h2: "## ", h3: "### ", h4: "#### ", li: "- " };

export function extrairConteudo(html: string, limite = LIMITE_TEXTO): ConteudoPagina {
  let titulo: string | null = null;
  let tituloAtual = "";
  let dentroDoTitulo = false;
  const meta: Record<string, string> = {};
  let idioma: string | null = null;
  let imagens = 0;
  let imagensComDescricao = 0;
  let scripts = 0;
  let marcaDeApp = false;

  // Pilha de elementos abertos: ignorar tudo dentro de script, style, svg, [hidden] etc.
  const pilha: { tag: string; ignora: boolean }[] = [];
  let ignorando = 0;
  const linhas: string[] = [];
  let linha = "";

  const quebrar = () => {
    const limpa = linha.replace(/\s+/g, " ").trim();
    if (limpa && limpa !== "#" && limpa !== "-") linhas.push(limpa);
    linha = "";
  };

  const parser = new Parser(
    {
      onopentag(tag, atributos) {
        if (tag === "html" && atributos.lang) idioma = atributos.lang.slice(0, 16);
        if (tag === "title") dentroDoTitulo = true;
        if (tag === "meta") {
          const chave = (atributos.name ?? atributos.property ?? "").toLowerCase();
          if (chave && atributos.content) meta[chave] = atributos.content;
        }
        if (tag === "script") scripts++;
        if ((atributos.id === "root" || atributos.id === "app" || atributos.id === "__nuxt") && tag === "div") marcaDeApp = true;

        const ignora =
          IGNORAR.has(tag) || "hidden" in atributos || atributos["aria-hidden"] === "true";
        if (ignora) ignorando++;

        if (!ignorando) {
          if (BLOCOS.has(tag)) {
            quebrar();
            linha = MARCADOR[tag] ?? "";
          }
          if (tag === "img") {
            imagens++;
            const alt = (atributos.alt ?? "").trim();
            if (alt) {
              imagensComDescricao++;
              linha += ` [imagem: ${alt}] `;
            }
          }
          if (tag === "input" && (atributos.type === "submit" || atributos.type === "button") && atributos.value) {
            linha += ` ${atributos.value} `;
          }
        } else if (tag === "img") {
          imagens++;
        }

        if (!VAZIOS.has(tag)) pilha.push({ tag, ignora });
        else if (ignora) ignorando--;
      },
      ontext(texto) {
        if (dentroDoTitulo) tituloAtual += texto;
        if (!ignorando) linha += texto;
      },
      onclosetag(tag) {
        if (tag === "title") {
          dentroDoTitulo = false;
          titulo = tituloAtual.replace(/\s+/g, " ").trim() || null;
        }
        if (VAZIOS.has(tag)) return;
        // Fecha até achar a tag correspondente (HTML mal formado é comum em páginas de vendas).
        while (pilha.length) {
          const aberto = pilha.pop()!;
          if (aberto.ignora) ignorando--;
          if (aberto.tag === tag) break;
        }
        if (!ignorando && BLOCOS.has(tag)) quebrar();
      },
    },
    { decodeEntities: true, lowerCaseTags: true, lowerCaseAttributeNames: true },
  );
  parser.write(html);
  parser.end();
  quebrar();

  const unicas = removerRepeticoes(linhas);
  let texto = unicas.join("\n");
  const truncado = texto.length > limite;
  if (truncado) texto = texto.slice(0, texto.lastIndexOf("\n", limite) > 0 ? texto.lastIndexOf("\n", limite) : limite);

  const palavras = contarPalavras(texto);
  const descricao = (meta.description ?? meta["og:description"] ?? "").replace(/\s+/g, " ").trim() || null;
  const tituloFinal = titulo ?? (meta["og:title"]?.trim() || null);

  return {
    titulo: tituloFinal ? tituloFinal.slice(0, 300) : null,
    descricao: descricao ? descricao.slice(0, 500) : null,
    idioma,
    texto,
    palavras,
    truncado,
    imagens,
    imagensComDescricao,
    precos: encontrarPrecos(texto),
    garantia: encontrarGarantia(texto),
    pareceDinamica: palavras < MINIMO_PALAVRAS && (marcaDeApp || scripts >= 5),
  };
}

// Páginas de vendas repetem botões e chamadas ("Quero me inscrever") muitas vezes.
// Mantém as duas primeiras ocorrências de cada linha curta e corta as demais.
function removerRepeticoes(linhas: string[]): string[] {
  const vistas = new Map<string, number>();
  const saida: string[] = [];
  for (const l of linhas) {
    const chave = l.toLowerCase();
    const n = (vistas.get(chave) ?? 0) + 1;
    vistas.set(chave, n);
    if (n <= 2 || l.length > 200) {
      if (saida[saida.length - 1] !== l) saida.push(l);
    }
  }
  return saida;
}

export function contarPalavras(texto: string): number {
  return texto.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

const PRECO = /(?:R\$|US\$|U\$|\$|€|£)\s?\d{1,3}(?:[.\s]\d{3})*(?:,\d{1,2})?(?![\d])/g;

function encontrarPrecos(texto: string): string[] {
  const achados = new Set<string>();
  for (const m of texto.matchAll(PRECO)) {
    achados.add(m[0].replace(/\s+/g, " ").trim());
    if (achados.size >= 10) break;
  }
  return [...achados];
}

// Prefere uma frase de verdade sobre a garantia ("Garantia de 7 dias...") a um título ou item de menu.
function encontrarGarantia(texto: string): string | null {
  const candidatas = texto
    .split("\n")
    .filter((l) => /garantia/i.test(l) && !l.startsWith("#"))
    .map((l) => l.replace(/^-\s+/, ""));
  const frase = candidatas.find((l) => contarPalavras(l) >= 6) ?? null;
  if (!frase) return null;
  return frase.length > 240 ? `${frase.slice(0, 237)}...` : frase;
}
