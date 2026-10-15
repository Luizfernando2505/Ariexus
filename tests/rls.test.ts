// Prova que um usuário não lê nem altera projetos de outro.
// Roda a migração real num Postgres em memória (PGlite) com um esqueleto do schema auth do Supabase.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";

const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";

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
`;

let db: PGlite;

async function as(user: string | null, sql: string, params: unknown[] = []) {
  await db.exec(user ? "set role authenticated" : "set role anon");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user ?? ""]);
  try {
    return await db.query<Record<string, unknown>>(sql, params);
  } finally {
    await db.exec("reset role");
  }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_SHIM);
  await db.exec(
    readFileSync(new URL("../supabase/migrations/0001_contas_e_projetos.sql", import.meta.url), "utf8"),
  );
  await db.query("insert into auth.users (id) values ($1), ($2)", [A, B]);
});

describe("RLS de projetos", () => {
  it("cria o perfil junto com a conta", async () => {
    const { rows } = await as(A, "select id, plano from public.profiles");
    expect(rows).toEqual([{ id: A, plano: "beta" }]);
  });

  it("dono cria e lê o próprio projeto", async () => {
    await as(A, "insert into public.projects (name) values ('Oferta do A')");
    const { rows } = await as(A, "select name, owner_id from public.projects");
    expect(rows).toEqual([{ name: "Oferta do A", owner_id: A }]);
  });

  it("outro usuário não vê o projeto", async () => {
    const { rows } = await as(B, "select * from public.projects");
    expect(rows).toHaveLength(0);
  });

  it("outro usuário não renomeia nem exclui", async () => {
    const upd = await as(B, "update public.projects set name = 'invadido'");
    const del = await as(B, "delete from public.projects");
    expect(upd.affectedRows).toBe(0);
    expect(del.affectedRows).toBe(0);
    const { rows } = await as(A, "select name from public.projects");
    expect(rows).toEqual([{ name: "Oferta do A" }]);
  });

  it("ninguém cria projeto em nome de outro", async () => {
    await expect(
      as(B, "insert into public.projects (name, owner_id) values ('falso', $1)", [A]),
    ).rejects.toThrow(/row-level security/);
  });

  it("dono não transfere o projeto", async () => {
    await expect(as(A, "update public.projects set owner_id = $1", [B])).rejects.toThrow();
  });

  it("visitante sem login não acessa nada", async () => {
    await expect(as(null, "select * from public.projects")).rejects.toThrow(/permission denied/);
    await expect(as(null, "select * from public.profiles")).rejects.toThrow(/permission denied/);
  });

  it("usuário não muda o próprio plano, só o perfil", async () => {
    await expect(as(A, "update public.profiles set plano = 'scale'")).rejects.toThrow(/permission denied/);
    const ok = await as(A, "update public.profiles set perfil = 'afiliado'");
    expect(ok.affectedRows).toBe(1);
    const { rows } = await as(B, "select * from public.profiles where id = $1", [A]);
    expect(rows).toHaveLength(0);
  });

  it("nome vazio é recusado", async () => {
    await expect(as(A, "insert into public.projects (name) values ('   ')")).rejects.toThrow(/check/);
  });
});
