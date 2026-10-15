"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/site-url";

export type LoginState = { status: "idle" | "sent" | "error"; message?: string };

const emailSchema = z.string().trim().toLowerCase().email().max(254);

export async function sendMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { status: "error", message: "Digite um e-mail válido." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: {
      // Beta fechado: só entra quem foi cadastrado no painel do Supabase.
      shouldCreateUser: false,
      emailRedirectTo: `${siteUrl()}/auth/callback`,
    },
  });

  if (error && error.status === 429) {
    return { status: "error", message: "Muitas tentativas. Espere alguns minutos e tente de novo." };
  }

  // Mesma resposta para e-mail cadastrado ou não, para não revelar quem tem conta.
  return {
    status: "sent",
    message: "Se este e-mail tiver acesso ao beta, você vai receber um link para entrar. Abra o link neste mesmo navegador.",
  };
}
