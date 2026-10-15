// Garante que a landing aprovada não mudou sem querer.
// Uso: node scripts/check-landing.mjs            -> compara o arquivo com landing.sha256
//      node scripts/check-landing.mjs <url>      -> compara também o HTML servido em <url>
// Para aprovar uma nova versão da landing, atualize landing.sha256 no mesmo commit.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const expected = readFileSync(new URL("../landing.sha256", import.meta.url), "utf8").trim();
const file = readFileSync(new URL("../public/landing.html", import.meta.url));

let ok = true;
const check = (label, actual) => {
  const match = actual === expected;
  console.log(`${match ? "OK " : "ERRO"} ${label}: ${actual}`);
  ok &&= match;
};

check("public/landing.html", sha256(file));

const url = process.argv[2];
if (url) {
  const res = await fetch(url);
  if (!res.ok) {
    console.log(`ERRO ${url} respondeu ${res.status}`);
    process.exit(1);
  }
  check(`servido em ${url}`, sha256(Buffer.from(await res.arrayBuffer())));
}

if (!ok) {
  console.log(`Esperado: ${expected}`);
  process.exit(1);
}
