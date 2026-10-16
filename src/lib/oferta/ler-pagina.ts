import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import http from "node:http";
import https from "node:https";
import type { Readable } from "node:stream";
import zlib from "node:zlib";
import { ErroAnalise } from "./erros";
import { enderecoProibido, validarUrlOferta } from "./url";

// Lê a página da oferta no nosso servidor, com limites de tempo, tamanho e redirecionamentos.
// Usa node:http(s) em vez de fetch porque só assim conferimos o IP no momento exato da conexão.

export type PaginaBaixada = {
  urlFinal: URL;
  html: string;
  status: number;
  bytes: number;
  /** A página passou do limite de tamanho e foi lida só até ele. */
  cortada: boolean;
};

export type OpcoesLeitura = {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirecionamentos?: number;
  /** Só para testes locais: libera o loopback (127.0.0.1) e qualquer porta. Nunca ligado na Vercel. */
  permitirLoopback?: boolean;
  /** Só para testes: substitui o DNS. */
  resolver?: (host: string) => Promise<LookupAddress[]>;
};

export const LIMITES_LEITURA = { timeoutMs: 10_000, maxBytes: 2 * 1024 * 1024, maxRedirecionamentos: 3 };

/**
 * Só para o teste de ponta a ponta em máquina local: libera a leitura de 127.0.0.1.
 * Exige ARIEXUS_TESTE_REDE_LOCAL=1 e é ignorado sempre que o código roda na Vercel.
 */
export function redeLocalDeTeste(env: Record<string, string | undefined> = process.env): boolean {
  return env.ARIEXUS_TESTE_REDE_LOCAL === "1" && !env.VERCEL;
}

const USER_AGENT = "Mozilla/5.0 (compatible; AriexusBot/1.0; +https://ariexus.vercel.app)";
const REDIRECIONAMENTOS = new Set([301, 302, 303, 307, 308]);

export async function lerPagina(url: URL, opcoes: OpcoesLeitura = {}): Promise<PaginaBaixada> {
  const limites = { ...LIMITES_LEITURA, ...opcoes };
  const prazo = Date.now() + limites.timeoutMs;
  // Confere de novo aqui: o Node não consulta o DNS (nem o lookupSeguro) quando o endereço já é um IP.
  let atual = validarUrlOferta(url.href, undefined, { permitirLoopback: opcoes.permitirLoopback });

  for (let saltos = 0; ; saltos++) {
    const resposta = await requisitar(atual, prazo, limites);
    if (resposta.tipo === "pagina") return { urlFinal: atual, ...resposta.pagina };
    if (saltos >= limites.maxRedirecionamentos) throw new ErroAnalise("redirecionamentos_demais");
    atual = validarUrlOferta(resposta.destino, atual, { permitirLoopback: opcoes.permitirLoopback });
  }
}

type Resposta =
  | { tipo: "redirecionamento"; destino: string }
  | { tipo: "pagina"; pagina: Omit<PaginaBaixada, "urlFinal"> };

function requisitar(
  url: URL,
  prazo: number,
  opcoes: OpcoesLeitura & typeof LIMITES_LEITURA,
): Promise<Resposta> {
  return new Promise((resolve, reject) => {
    const restante = prazo - Date.now();
    if (restante <= 0) return reject(new ErroAnalise("tempo_esgotado"));

    const modulo = url.protocol === "https:" ? https : http;
    const req = modulo.request(
      url,
      {
        method: "GET",
        agent: false,
        lookup: lookupSeguro(opcoes),
        headers: {
          "user-agent": USER_AGENT,
          accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
          "accept-language": "pt-BR,pt;q=0.9,en;q=0.6,es;q=0.5",
          "accept-encoding": "gzip, deflate, br",
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;

        if (REDIRECIONAMENTOS.has(status)) {
          res.resume();
          const destino = res.headers.location;
          if (!destino) return falhar(new ErroAnalise("pagina_erro_http", `erro ${status}`));
          return concluir({ tipo: "redirecionamento", destino });
        }
        if (status >= 400 || status < 200) {
          res.resume();
          return falhar(erroDeStatus(status));
        }

        const tipo = String(res.headers["content-type"] ?? "").toLowerCase();
        if (tipo && !tipo.includes("text/html") && !tipo.includes("application/xhtml+xml")) {
          res.destroy();
          return falhar(new ErroAnalise("nao_e_html"));
        }

        let corpo: Readable;
        try {
          corpo = descompactar(res, String(res.headers["content-encoding"] ?? ""));
        } catch (e) {
          res.destroy();
          return falhar(e);
        }

        const partes: Buffer[] = [];
        let bytes = 0;
        let cortada = false;
        corpo.on("data", (parte: Buffer) => {
          if (cortada) return;
          const cabe = opcoes.maxBytes - bytes;
          if (parte.length >= cabe) {
            partes.push(parte.subarray(0, cabe));
            bytes += cabe;
            cortada = true;
            corpo.destroy();
            res.destroy();
            terminar();
            return;
          }
          partes.push(parte);
          bytes += parte.length;
        });
        corpo.on("end", terminar);
        corpo.on("error", (e) => (cortada ? undefined : falhar(traduzirErroDeRede(e))));

        function terminar() {
          const buffer = Buffer.concat(partes);
          if (!tipo && !pareceHtml(buffer)) return falhar(new ErroAnalise("nao_e_html"));
          concluir({ tipo: "pagina", pagina: { html: decodificar(buffer, tipo), status, bytes, cortada } });
        }
      },
    );

    let encerrado = false;
    const relogio = setTimeout(() => {
      falhar(new ErroAnalise("tempo_esgotado"));
      req.destroy();
    }, restante);

    function concluir(valor: Resposta) {
      if (encerrado) return;
      encerrado = true;
      clearTimeout(relogio);
      resolve(valor);
    }
    function falhar(erro: unknown) {
      if (encerrado) return;
      encerrado = true;
      clearTimeout(relogio);
      reject(erro instanceof ErroAnalise ? erro : traduzirErroDeRede(erro));
    }

    req.on("error", falhar);
    req.end();
  });
}

// Confere cada IP devolvido pelo DNS antes de conectar.
function lookupSeguro(opcoes: OpcoesLeitura) {
  const resolver =
    opcoes.resolver ??
    ((host: string) =>
      new Promise<LookupAddress[]>((ok, erro) =>
        dnsLookup(host, { all: true, verbatim: true }, (e, enderecos) => (e ? erro(e) : ok(enderecos))),
      ));

  return (
    host: string,
    options: { all?: boolean },
    callback: (erro: NodeJS.ErrnoException | null, endereco: string | LookupAddress[], familia?: number) => void,
  ) => {
    resolver(host).then(
      (enderecos) => {
        if (!enderecos.length) return callback(Object.assign(new Error("sem endereço"), { code: "ENOTFOUND" }), "");
        const permitirLoopback = opcoes.permitirLoopback;
        if (enderecos.some((e) => enderecoProibido(e.address, { permitirLoopback }))) {
          return callback(new ErroAnalise("url_bloqueada") as unknown as NodeJS.ErrnoException, "");
        }
        if (options.all) return callback(null, enderecos);
        callback(null, enderecos[0].address, enderecos[0].family);
      },
      (e: NodeJS.ErrnoException) => callback(e, ""),
    );
  };
}

function descompactar(res: http.IncomingMessage, codificacao: string): Readable {
  const c = codificacao.trim().toLowerCase();
  if (!c || c === "identity") return res;
  // Limites de memória do zlib evitam "bombas" de compressão; o corte por bytes acontece depois.
  if (c === "gzip" || c === "x-gzip") return res.pipe(zlib.createGunzip());
  if (c === "deflate") return res.pipe(zlib.createInflate());
  if (c === "br") return res.pipe(zlib.createBrotliDecompress());
  throw new ErroAnalise("nao_e_html");
}

function erroDeStatus(status: number): ErroAnalise {
  if ([401, 403, 407, 429, 451].includes(status)) return new ErroAnalise("pagina_recusou", `erro ${status}`);
  if (status === 404 || status === 410) return new ErroAnalise("pagina_erro_http", `erro ${status}, a página não existe`);
  if (status >= 500) return new ErroAnalise("pagina_erro_servidor", `erro ${status}`);
  return new ErroAnalise("pagina_erro_http", `erro ${status}`);
}

export function traduzirErroDeRede(erro: unknown): ErroAnalise {
  if (erro instanceof ErroAnalise) return erro;
  const codigo = String((erro as { code?: string })?.code ?? "");
  if (codigo === "ENOTFOUND" || codigo === "EAI_AGAIN" || codigo === "ENODATA") return new ErroAnalise("pagina_nao_encontrada");
  if (codigo === "ETIMEDOUT" || codigo === "ESOCKETTIMEDOUT") return new ErroAnalise("tempo_esgotado");
  if (/CERT|TLS|SSL|SELF_SIGNED|UNABLE_TO_VERIFY/.test(codigo)) {
    return new ErroAnalise("pagina_inacessivel", "certificado de segurança inválido");
  }
  return new ErroAnalise("pagina_inacessivel");
}

function pareceHtml(buffer: Buffer): boolean {
  const inicio = buffer.subarray(0, 2048).toString("latin1").toLowerCase();
  return /<!doctype html|<html|<head|<body|<meta|<title/.test(inicio);
}

function decodificar(buffer: Buffer, contentType: string): string {
  let charset = /charset=["']?([\w-]+)/i.exec(contentType)?.[1];
  if (!charset) {
    const inicio = buffer.subarray(0, 4096).toString("latin1");
    charset = /<meta[^>]+charset=["']?([\w-]+)/i.exec(inicio)?.[1];
  }
  try {
    return new TextDecoder(charset ?? "utf-8").decode(buffer);
  } catch {
    return new TextDecoder("utf-8").decode(buffer);
  }
}
