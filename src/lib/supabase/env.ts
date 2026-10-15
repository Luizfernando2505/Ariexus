// A Supabase chama a chave pública de "publishable" (projetos novos) ou "anon" (projetos antigos).
// As duas são públicas por design: a proteção dos dados vem do RLS no banco.
export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Faltam NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (ou _ANON_KEY).",
    );
  }
  return { url, key };
}
