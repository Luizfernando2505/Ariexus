import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = { id: string; email: string | null };

// Camada de acesso: toda página logada pega o usuário daqui.
// getClaims valida a assinatura do token; getSession sozinho não serve para autorizar.
export async function requireUser(): Promise<CurrentUser> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect("/entrar");
  return { id: claims.sub, email: (claims.email as string | undefined) ?? null };
}
