// Prova, no Postgres de verdade (PGlite), que as análises e os limites de uso respeitam o dono
// e que ninguém passa do limite nem mexe no próprio contador.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";

const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";

// Esqueleto do que o Supabase já tem: papéis, auth.uid() e as permissões padrão do schema public.
const SUPABASE_SHIM = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
`;

let db: PGlite;

async function como(user: string | null, sql: string, params: unknown[] = []) {
  await db.exec(user ? "set role authenticated" : "set role anon");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user ?? ""]);
  try {
    return await db.query<Record<string, unknown>>(sql, params);
  } finally {
    await db.exec("reset role");
  }
}

async function falha(user: string | null, sql: string, params: unknown[] = []): Promise<string> {
  try {
    await como(user, sql, params);
  } catch (e) {
    return (e as Error).message;
  }
  throw new Error(`deveria ter falhado: ${sql}`);
}

const registrar = async (user: string, kind: string) =>
  (await como(user, "select * from public.registrar_uso($1)", [kind])).rows[0];

const migracao = (nome: string) => readFileSync(new URL(`../supabase/migrations/${nome}`, import.meta.url), "utf8");

let projetoA: string;
let projetoB: string;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_SHIM);
  await db.exec(migracao("0001_contas_e_projetos.sql"));
  await db.exec(migracao("0002_analises.sql"));
  await db.query("insert into auth.users (id) values ($1), ($2)", [A, B]);
  projetoA = (await como(A, "insert into public.projects (name) values ('Oferta A') returning id")).rows[0].id as string;
  projetoB = (await como(B, "insert into public.projects (name) values ('Oferta B') returning id")).rows[0].id as string;
});

describe("registrar_uso", () => {
  it("registra leituras dentro do limite do plano beta", async () => {
    expect(await registrar(A, "leitura")).toEqual({ permitido: true, usados: 1, limite: 30 });
    expect(await registrar(A, "leitura")).toEqual({ permitido: true, usados: 2, limite: 30 });
  });

  it("para na 11ª análise do mês sem gravar o excesso", async () => {
    for (let i = 1; i <= 10; i++) expect(await registrar(A, "analise")).toEqual({ permitido: true, usados: i, limite: 10 });
    expect(await registrar(A, "analise")).toEqual({ permitido: false, usados: 10, limite: 10 });
    const { rows } = await como(A, "select count(*)::int as n from public.usage_events where kind = 'analise'");
    expect(rows[0].n).toBe(10);
  });

  it("conta cada usuário separado", async () => {
    expect(await registrar(B, "analise")).toEqual({ permitido: true, usados: 1, limite: 10 });
  });

  it("não conta uso fora da janela: leitura de 2 horas atrás e análise do mês passado", async () => {
    const C = "00000000-0000-0000-0000-00000000000c";
    await db.query("insert into auth.users (id) values ($1)", [C]);
    await db.query(
      `insert into public.usage_events (owner_id, kind, created_at) values
         ($1, 'leitura', now() - interval '2 hours'),
         ($1, 'analise', date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo' - interval '1 minute')`,
      [C],
    );
    expect(await registrar(C, "leitura")).toMatchObject({ usados: 1 });
    expect(await registrar(C, "analise")).toMatchObject({ usados: 1 });
  });

  it("segue o limite do plano da conta", async () => {
    const D = "00000000-0000-0000-0000-00000000000d";
    await db.query("insert into auth.users (id) values ($1)", [D]);
    await db.query("update public.profiles set plano = 'pro' where id = $1", [D]);
    expect(await registrar(D, "analise")).toEqual({ permitido: true, usados: 1, limite: 12 });
  });

  it("recusa tipo inválido e quem não está logado", async () => {
    expect(await falha(A, "select * from public.registrar_uso('outra')")).toContain("tipo de uso inválido");
    expect(await falha(null, "select * from public.registrar_uso('leitura')")).toContain("permission denied");
  });

  it("consultar_uso mostra o uso atual de quem pergunta", async () => {
    const { rows } = await como(A, "select * from public.consultar_uso()");
    expect(rows[0]).toEqual({ analises_usadas: 10, analises_limite: 10, leituras_usadas: 2, leituras_limite: 30 });
  });
});

describe("usuário não mexe no próprio contador nem nos limites", () => {
  it("lê só o próprio uso", async () => {
    const { rows } = await como(B, "select distinct owner_id from public.usage_events");
    expect(rows).toEqual([{ owner_id: B }]);
  });

  it("não insere, apaga nem altera eventos de uso", async () => {
    expect(await falha(A, "insert into public.usage_events (owner_id, kind) values ($1, 'analise')", [A])).toContain("permission denied");
    expect(await falha(A, "delete from public.usage_events")).toContain("permission denied");
    expect(await falha(A, "update public.usage_events set created_at = now() - interval '40 days'")).toContain("permission denied");
  });

  it("não altera os limites do plano nem o próprio plano", async () => {
    expect(await falha(A, "update public.plan_limits set analises_mes = 9999")).toContain("permission denied");
    expect(await falha(A, "update public.profiles set plano = 'scale'")).toContain("permission denied");
    expect((await como(A, "select analises_mes from public.plan_limits where plano = 'beta'")).rows[0].analises_mes).toBe(10);
  });

  it("anônimo não vê nada", async () => {
    expect(await falha(null, "select * from public.usage_events")).toContain("permission denied");
    expect(await falha(null, "select * from public.analyses")).toContain("permission denied");
  });
});

const PAGINA = JSON.stringify({ titulo: "Oferta" });
const inserir = (user: string, projeto: string, extra = "") =>
  como(
    user,
    `insert into public.analyses (project_id, url, url_final, entrada, status, modo, pagina, texto_pagina, resultado)
     values ($1, 'https://a.com', 'https://a.com', '{}', 'concluida', 'simulado', $2, 'texto', '{"ok":true}') ${extra}`,
    [projeto, PAGINA],
  );

describe("RLS das análises", () => {
  let analiseA: string;

  it("dono salva análise no próprio projeto", async () => {
    analiseA = (await inserir(A, projetoA, "returning id")).rows[0].id as string;
    const { rows } = await como(A, "select owner_id, project_id from public.analyses");
    expect(rows).toEqual([{ owner_id: A, project_id: projetoA }]);
  });

  it("ninguém salva análise no projeto de outro, nem como outro dono", async () => {
    expect(await falha(B, "insert into public.analyses (project_id, url, url_final, entrada, status, modo, pagina, texto_pagina) values ($1, 'u', 'u', '{}', 'somente_leitura', 'desligado', '{}', 't')", [projetoA])).toContain(
      "row-level security",
    );
    expect(
      await falha(B, "insert into public.analyses (owner_id, project_id, url, url_final, entrada, status, modo, pagina, texto_pagina) values ($1, $2, 'u', 'u', '{}', 'somente_leitura', 'desligado', '{}', 't')", [A, projetoA]),
    ).toContain("row-level security");
  });

  it("outro usuário não vê nem exclui", async () => {
    expect((await como(B, "select * from public.analyses")).rows).toHaveLength(0);
    await como(B, "delete from public.analyses where id = $1", [analiseA]);
    expect((await como(A, "select id from public.analyses")).rows).toHaveLength(1);
  });

  it("análise salva não é editada", async () => {
    expect(await falha(A, "update public.analyses set resultado = '{}' where id = $1", [analiseA])).toContain("permission denied");
  });

  it("o formato salvo é coerente", async () => {
    expect(await falha(A, "insert into public.analyses (project_id, url, url_final, entrada, status, modo, pagina, texto_pagina) values ($1, 'u', 'u', '{}', 'concluida', 'simulado', '{}', 't')", [projetoA])).toContain("check constraint");
    expect(await falha(A, "insert into public.analyses (project_id, url, url_final, entrada, status, modo, pagina, texto_pagina) values ($1, 'u', 'u', '{}', 'somente_leitura', 'anthropic', '{}', 't')", [projetoA])).toContain("check constraint");
    expect(await falha(A, "insert into public.analyses (project_id, url, url_final, entrada, status, modo, pagina, texto_pagina) values ($1, 'u', 'u', '{}', 'somente_leitura', 'desligado', '{}', repeat('a', 60001))", [projetoA])).toContain("check constraint");
  });

  it("dono exclui a própria análise, e excluir o projeto apaga as análises", async () => {
    await como(A, "delete from public.analyses where id = $1", [analiseA]);
    expect((await como(A, "select id from public.analyses")).rows).toHaveLength(0);

    await inserir(A, projetoA);
    await como(A, "delete from public.projects where id = $1", [projetoA]);
    expect((await db.query("select id from public.analyses where project_id = $1", [projetoA])).rows).toHaveLength(0);
  });

  it("o projeto do outro usuário segue intacto", async () => {
    expect((await como(B, "select id from public.projects")).rows).toEqual([{ id: projetoB }]);
  });
});
