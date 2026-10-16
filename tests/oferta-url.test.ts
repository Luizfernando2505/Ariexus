// Proteção contra SSRF na URL digitada e nos redirecionamentos.
import { describe, expect, it } from "vitest";
import { ErroAnalise } from "../src/lib/oferta/erros";
import { enderecoProibido, validarUrlOferta } from "../src/lib/oferta/url";

function codigo(fn: () => unknown): string | null {
  try {
    fn();
    return null;
  } catch (e) {
    return e instanceof ErroAnalise ? e.codigo : "outro";
  }
}

describe("validarUrlOferta", () => {
  it("aceita páginas públicas http e https e remove o #", () => {
    expect(validarUrlOferta("https://go.hotmart.com/X123?ap=1#topo").href).toBe("https://go.hotmart.com/X123?ap=1");
    expect(validarUrlOferta("  http://exemplo.com.br/oferta  ").href).toBe("http://exemplo.com.br/oferta");
    expect(validarUrlOferta("https://exemplo.com:443/").href).toBe("https://exemplo.com/");
    expect(codigo(() => validarUrlOferta("http://exemplo.com./"))).toBeNull();
  });

  it("completa https:// quando a pessoa cola sem o protocolo", () => {
    expect(validarUrlOferta("exemplo.com.br/curso").href).toBe("https://exemplo.com.br/curso");
  });

  it.each([
    ["", "url_invalida"],
    ["isso não é url", "url_invalida"],
    ["ftp://exemplo.com/arquivo", "url_invalida"],
    ["javascript:alert(1)", "url_invalida"],
    ["file:///etc/passwd", "url_invalida"],
    ["data:text/html,<b>oi</b>", "url_invalida"],
    [`https://exemplo.com/${"a".repeat(2100)}`, "url_invalida"],
  ])("recusa entrada inválida %#", (url, esperado) => {
    expect(codigo(() => validarUrlOferta(url))).toBe(esperado);
  });

  it.each([
    "http://localhost/",
    "http://localhost:3000/",
    "http://app.localhost/",
    "http://127.0.0.1/",
    "http://127.1/",
    "http://2130706433/",
    "http://0x7f000001/",
    "http://0.0.0.0/",
    "http://10.0.0.5/",
    "http://172.16.3.4/",
    "http://192.168.0.1/",
    "http://169.254.169.254/latest/meta-data/",
    "http://100.64.0.1/",
    "http://[::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://[::ffff:7f00:1]/",
    "http://[fd00::1]/",
    "http://[fe80::1]/",
    "http://servidor-interno/",
    "http://impressora.local/",
    "http://db.internal/",
    "http://roteador.lan/",
    "http://usuario:senha@exemplo.com/",
    "https://exemplo.com:8443/",
    "http://exemplo.com:22/",
    "http://localhost./",
  ])("bloqueia endereço interno ou fora do padrão: %s", (url) => {
    expect(codigo(() => validarUrlOferta(url))).toBe("url_bloqueada");
  });

  it("confere redirecionamentos relativos contra a página de origem", () => {
    const base = new URL("https://exemplo.com/a/b");
    expect(validarUrlOferta("../c", base).href).toBe("https://exemplo.com/c");
    expect(codigo(() => validarUrlOferta("http://169.254.169.254/", base))).toBe("url_bloqueada");
  });

  it("no modo de teste local libera só o loopback", () => {
    const teste = { permitirLoopback: true };
    expect(validarUrlOferta("http://127.0.0.1:4010/x", undefined, teste).port).toBe("4010");
    expect(validarUrlOferta("http://localhost:4010/x", undefined, teste).hostname).toBe("localhost");
    expect(codigo(() => validarUrlOferta("http://169.254.169.254/", undefined, teste))).toBe("url_bloqueada");
    expect(codigo(() => validarUrlOferta("http://10.0.0.1/", undefined, teste))).toBe("url_bloqueada");
  });
});

describe("enderecoProibido", () => {
  it.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111", "::ffff:8.8.8.8"])("libera IP público %s", (ip) => {
    expect(enderecoProibido(ip)).toBe(false);
  });
  it.each(["127.0.0.1", "10.1.2.3", "169.254.169.254", "::1", "fc00::1", "::ffff:10.0.0.1", "64:ff9b::a00:1", "não é ip"])(
    "bloqueia %s",
    (ip) => {
      expect(enderecoProibido(ip)).toBe(true);
    },
  );
});
