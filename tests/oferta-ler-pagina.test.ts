// Leitura da página contra um servidor HTTP local: limites, redirecionamentos, compressão, erros e SSRF na conexão.
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import zlib from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ErroAnalise } from "../src/lib/oferta/erros";
import { lerPagina, redeLocalDeTeste, type OpcoesLeitura } from "../src/lib/oferta/ler-pagina";

const HTML = "<!doctype html><html><head><title>Oferta</title></head><body><p>Olá, mundo da página de vendas.</p></body></html>";

let servidor: Server;
let base: string;
let porta: number;

beforeAll(async () => {
  servidor = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    const html = (corpo: Buffer | string, extra: Record<string, string> = {}) => {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", ...extra });
      res.end(corpo);
    };
    switch (url.pathname) {
      case "/ok":
        return html(HTML);
      case "/gzip":
        return html(zlib.gzipSync(HTML), { "content-encoding": "gzip" });
      case "/br":
        return html(zlib.brotliCompressSync(HTML), { "content-encoding": "br" });
      case "/deflate":
        return html(zlib.deflateSync(HTML), { "content-encoding": "deflate" });
      case "/bomba":
        // 50 MB de zeros comprimidos em poucos KB.
        return html(zlib.gzipSync(Buffer.alloc(50 * 1024 * 1024)), { "content-encoding": "gzip" });
      case "/codificacao-estranha":
        return html("xx", { "content-encoding": "compress" });
      case "/grande":
        return html("<html><body>" + "a".repeat(5000) + "</body></html>");
      case "/latin1":
        res.writeHead(200, { "content-type": "text/html; charset=windows-1252" });
        return res.end(Buffer.from("<html><body>Promoção é aqui</body></html>", "latin1"));
      case "/latin1-meta":
        res.writeHead(200, { "content-type": "text/html" });
        return res.end(Buffer.from('<html><head><meta charset="iso-8859-1"></head><body>Coração</body></html>', "latin1"));
      case "/sem-tipo-html":
        res.writeHead(200);
        return res.end(HTML);
      case "/sem-tipo-binario":
        res.writeHead(200);
        return res.end(Buffer.from([0x25, 0x50, 0x44, 0x46, 0x00, 0x01]));
      case "/pdf":
        res.writeHead(200, { "content-type": "application/pdf" });
        return res.end("%PDF-1.4");
      case "/r1":
        res.writeHead(301, { location: "/r2" });
        return res.end();
      case "/r2":
        res.writeHead(302, { location: `${base}/ok` });
        return res.end();
      case "/loop":
        res.writeHead(302, { location: "/loop" });
        return res.end();
      case "/para-metadados":
        res.writeHead(302, { location: "http://169.254.169.254/latest/meta-data/" });
        return res.end();
      case "/para-rede-privada":
        res.writeHead(307, { location: "http://10.0.0.1/" });
        return res.end();
      case "/para-ftp":
        res.writeHead(302, { location: "ftp://exemplo.com/" });
        return res.end();
      case "/sem-location":
        res.writeHead(302);
        return res.end();
      case "/mudo":
        return; // nunca responde
      case "/gotejando":
        res.writeHead(200, { "content-type": "text/html" });
        res.write("<html>");
        return; // cabeçalho chega, corpo nunca termina
      default: {
        const status = Number(url.pathname.slice(1));
        res.writeHead(Number.isInteger(status) && status >= 100 ? status : 404);
        return res.end("erro");
      }
    }
  });
  await new Promise<void>((ok) => servidor.listen(0, "127.0.0.1", ok));
  porta = (servidor.address() as AddressInfo).port;
  base = `http://127.0.0.1:${porta}`;
});

afterAll(() => {
  servidor.closeAllConnections();
  servidor.close();
});

const local: OpcoesLeitura = { permitirLoopback: true, timeoutMs: 2000 };
const ler = (caminho: string, opcoes: OpcoesLeitura = {}) => lerPagina(new URL(base + caminho), { ...local, ...opcoes });

async function erro(promessa: Promise<unknown>): Promise<ErroAnalise> {
  try {
    await promessa;
  } catch (e) {
    if (e instanceof ErroAnalise) return e;
    throw e;
  }
  throw new Error("era para falhar");
}

describe("lerPagina", () => {
  it("lê HTML simples e informa status e tamanho", async () => {
    const p = await ler("/ok");
    expect(p.status).toBe(200);
    expect(p.html).toBe(HTML);
    expect(p.bytes).toBe(Buffer.byteLength(HTML));
    expect(p.cortada).toBe(false);
  });

  it.each(["/gzip", "/br", "/deflate"])("descompacta %s", async (caminho) => {
    expect((await ler(caminho)).html).toBe(HTML);
  });

  it("para de ler no limite de tamanho, inclusive em bomba de compressão", async () => {
    const grande = await ler("/grande", { maxBytes: 1000 });
    expect(grande.cortada).toBe(true);
    expect(grande.bytes).toBe(1000);

    const bomba = await ler("/bomba", { maxBytes: 64 * 1024 });
    expect(bomba.cortada).toBe(true);
    expect(bomba.bytes).toBe(64 * 1024);
  });

  it("decodifica windows-1252 pelo cabeçalho ou pela meta tag", async () => {
    expect((await ler("/latin1")).html).toContain("Promoção é aqui");
    expect((await ler("/latin1-meta")).html).toContain("Coração");
  });

  it("aceita HTML sem content-type e recusa o que não é página", async () => {
    expect((await ler("/sem-tipo-html")).html).toBe(HTML);
    expect((await erro(ler("/sem-tipo-binario"))).codigo).toBe("nao_e_html");
    expect((await erro(ler("/pdf"))).codigo).toBe("nao_e_html");
    expect((await erro(ler("/codificacao-estranha"))).codigo).toBe("nao_e_html");
  });

  it("segue redirecionamentos e devolve o endereço final", async () => {
    const p = await ler("/r1");
    expect(p.urlFinal.href).toBe(`${base}/ok`);
    expect(p.html).toBe(HTML);
  });

  it("desiste depois de 3 redirecionamentos", async () => {
    expect((await erro(ler("/loop"))).codigo).toBe("redirecionamentos_demais");
  });

  it("bloqueia redirecionamento para metadados da nuvem, rede privada ou outro protocolo", async () => {
    expect((await erro(ler("/para-metadados"))).codigo).toBe("url_bloqueada");
    expect((await erro(ler("/para-rede-privada"))).codigo).toBe("url_bloqueada");
    expect((await erro(ler("/para-ftp"))).codigo).toBe("url_invalida");
    expect((await erro(ler("/sem-location"))).codigo).toBe("pagina_erro_http");
  });

  it.each([
    [404, "pagina_erro_http", "erro 404, a página não existe"],
    [410, "pagina_erro_http", "erro 410, a página não existe"],
    [403, "pagina_recusou", "erro 403"],
    [429, "pagina_recusou", "erro 429"],
    [500, "pagina_erro_servidor", "erro 500"],
    [503, "pagina_erro_servidor", "erro 503"],
    [418, "pagina_erro_http", "erro 418"],
  ])("traduz HTTP %i", async (status, codigo, detalhe) => {
    const e = await erro(ler(`/${status}`));
    expect(e.codigo).toBe(codigo);
    expect(e.detalhe).toBe(detalhe);
  });

  it("respeita o tempo limite, mesmo quando o corpo não termina", async () => {
    const inicio = Date.now();
    expect((await erro(ler("/mudo", { timeoutMs: 300 }))).codigo).toBe("tempo_esgotado");
    expect((await erro(ler("/gotejando", { timeoutMs: 300 }))).codigo).toBe("tempo_esgotado");
    expect(Date.now() - inicio).toBeLessThan(2000);
  });

  it("avisa quando não consegue conectar", async () => {
    const fechado = createServer();
    await new Promise<void>((ok) => fechado.listen(0, "127.0.0.1", ok));
    const portaFechada = (fechado.address() as AddressInfo).port;
    await new Promise((ok) => fechado.close(ok));
    const e = await erro(lerPagina(new URL(`http://127.0.0.1:${portaFechada}/`), local));
    expect(e.codigo).toBe("pagina_inacessivel");
  });
});

describe("lerPagina confere o IP na hora da conexão", () => {
  it("recusa IP interno escrito direto na URL, que não passa pelo DNS", async () => {
    for (const ip of ["http://10.0.0.1/", "http://169.254.169.254/", "http://[::1]/"]) {
      expect((await erro(lerPagina(new URL(ip), { timeoutMs: 2000 }))).codigo).toBe("url_bloqueada");
    }
  });

  // Porta padrão, sem modo de teste: só o lookupSeguro pode barrar estes casos.
  const url = () => new URL("http://oferta.teste/ok");

  it("conecta quando o DNS aponta para um endereço permitido", async () => {
    const p = await lerPagina(new URL(`http://oferta.teste:${porta}/ok`), {
      ...local,
      resolver: async () => [{ address: "127.0.0.1", family: 4 }],
    });
    expect(p.html).toBe(HTML);
  });

  it("bloqueia nome que resolve para IP interno (DNS rebinding)", async () => {
    for (const address of ["10.0.0.1", "169.254.169.254", "127.0.0.1"]) {
      const e = await erro(lerPagina(url(), { timeoutMs: 2000, resolver: async () => [{ address, family: 4 }] }));
      expect(e.codigo).toBe("url_bloqueada");
    }
  });

  it("bloqueia quando qualquer um dos IPs devolvidos é interno", async () => {
    const e = await erro(
      lerPagina(url(), {
        timeoutMs: 2000,
        resolver: async () => [
          { address: "93.184.216.34", family: 4 },
          { address: "::1", family: 6 },
        ],
      }),
    );
    expect(e.codigo).toBe("url_bloqueada");
  });

  it("traduz domínio inexistente", async () => {
    const e = await erro(
      lerPagina(url(), {
        timeoutMs: 2000,
        resolver: async () => {
          throw Object.assign(new Error("não existe"), { code: "ENOTFOUND" });
        },
      }),
    );
    expect(e.codigo).toBe("pagina_nao_encontrada");
  });
});

describe("redeLocalDeTeste", () => {
  it("só liga fora da Vercel e com a variável explícita", () => {
    expect(redeLocalDeTeste({})).toBe(false);
    expect(redeLocalDeTeste({ ARIEXUS_TESTE_REDE_LOCAL: "1" })).toBe(true);
    expect(redeLocalDeTeste({ ARIEXUS_TESTE_REDE_LOCAL: "1", VERCEL: "1" })).toBe(false);
    expect(redeLocalDeTeste({ ARIEXUS_TESTE_REDE_LOCAL: "true" })).toBe(false);
  });
});
