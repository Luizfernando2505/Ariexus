import { BlockList, isIP } from "node:net";
import { ErroAnalise } from "./erros";
import { TAMANHO_MAXIMO_URL } from "./opcoes";

// Proteção contra SSRF: só lemos páginas públicas da internet.
// A URL é conferida aqui e o IP de destino é conferido de novo na hora da conexão (ler-pagina.ts),
// para que um DNS que muda de resposta não leve a leitura para dentro da rede.

const PROIBIDOS = new BlockList();
for (const [rede, prefixo] of [
  ["0.0.0.0", 8], // "esta rede"
  ["10.0.0.0", 8], // privada
  ["100.64.0.0", 10], // NAT de operadora
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local, inclui metadados de nuvem (169.254.169.254)
  ["172.16.0.0", 12], // privada
  ["192.0.0.0", 24], // reservada IETF
  ["192.0.2.0", 24], // documentação
  ["192.88.99.0", 24], // relay 6to4
  ["192.168.0.0", 16], // privada
  ["198.18.0.0", 15], // testes de rede
  ["198.51.100.0", 24], // documentação
  ["203.0.113.0", 24], // documentação
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reservada e broadcast
] as const) {
  PROIBIDOS.addSubnet(rede, prefixo, "ipv4");
}
for (const [rede, prefixo] of [
  ["::", 128], // não especificado
  ["::1", 128], // loopback
  ["64:ff9b::", 96], // NAT64 (traduz para IPv4 interno)
  ["100::", 64], // descarte
  ["2001::", 32], // Teredo
  ["2001:db8::", 32], // documentação
  ["2002::", 16], // 6to4
  ["fc00::", 7], // privada (ULA)
  ["fe80::", 10], // link-local
  ["ff00::", 8], // multicast
] as const) {
  PROIBIDOS.addSubnet(rede, prefixo, "ipv6");
}

const LOOPBACK = new BlockList();
LOOPBACK.addSubnet("127.0.0.0", 8, "ipv4");
LOOPBACK.addAddress("::1", "ipv6");

/** Só para testes locais: libera o loopback (127.0.0.1, localhost) e qualquer porta, e mais nada. */
export type OpcoesUrl = { permitirLoopback?: boolean };

function ehLoopback(ip: string): boolean {
  const versao = isIP(ip);
  return versao === 4 ? LOOPBACK.check(ip, "ipv4") : versao === 6 && LOOPBACK.check(ip, "ipv6");
}

/** true quando o IP não é um endereço público da internet. */
export function enderecoProibido(ip: string, opcoes: OpcoesUrl = {}): boolean {
  if (opcoes.permitirLoopback && ehLoopback(ip)) return false;
  const versao = isIP(ip);
  if (versao === 4) return PROIBIDOS.check(ip, "ipv4");
  if (versao === 6) {
    const mapeado = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
    if (mapeado) return PROIBIDOS.check(mapeado[1], "ipv4");
    // ::ffff:7f00:1 (IPv4 mapeado em hexadecimal): qualquer ::ffff:0:0/96 é tratado como interno.
    if (/^::ffff:/i.test(ip)) return true;
    return PROIBIDOS.check(ip, "ipv6");
  }
  return true; // não é IP: quem chamou errou, então bloqueia
}

const SUFIXOS_INTERNOS = [".localhost", ".local", ".internal", ".lan", ".home.arpa", ".intranet", ".corp"];
const PORTAS_PERMITIDAS = new Set(["", "80", "443"]);

/** Confere a URL digitada (ou a de um redirecionamento). Lança ErroAnalise. */
export function validarUrlOferta(entrada: string, base?: URL, opcoes: OpcoesUrl = {}): URL {
  const texto = entrada.trim();
  if (!texto || texto.length > TAMANHO_MAXIMO_URL) throw new ErroAnalise("url_invalida");

  // Quem cola "site.com/oferta" sem https:// quer dizer https://site.com/oferta.
  const comEsquema = base || /^[a-z][a-z\d+.-]*:/i.test(texto) ? texto : `https://${texto}`;

  let url: URL;
  try {
    url = base ? new URL(comEsquema, base) : new URL(comEsquema);
  } catch {
    throw new ErroAnalise("url_invalida");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") throw new ErroAnalise("url_invalida");
  if (url.username || url.password) throw new ErroAnalise("url_bloqueada");
  if (!PORTAS_PERMITIDAS.has(url.port) && !opcoes.permitirLoopback) throw new ErroAnalise("url_bloqueada");

  const host = url.hostname.replace(/\.$/, "").toLowerCase();
  if (!host) throw new ErroAnalise("url_invalida");

  const semColchetes = host.startsWith("[") ? host.slice(1, -1) : host;
  if (isIP(semColchetes)) {
    if (enderecoProibido(semColchetes, opcoes)) throw new ErroAnalise("url_bloqueada");
  } else if (!(opcoes.permitirLoopback && host === "localhost")) {
    if (host === "localhost" || SUFIXOS_INTERNOS.some((s) => host.endsWith(s))) {
      throw new ErroAnalise("url_bloqueada");
    }
    if (!host.includes(".")) throw new ErroAnalise("url_bloqueada"); // nome sem domínio, típico de rede interna
  }

  url.hash = "";
  return url;
}
