import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseEnv } from "./env";

// Cliente com a sessão do usuário: toda consulta passa pelo RLS dele.
export async function createClient() {
  const cookieStore = await cookies();
  const { url, key } = supabaseEnv();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Chamado de um Server Component: o proxy já renova a sessão.
        }
      },
    },
  });
}
