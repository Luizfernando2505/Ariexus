import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

// Só a área logada e o login. A landing e as páginas legais não pagam o custo da sessão.
export const config = {
  matcher: ["/app/:path*", "/entrar", "/auth/:path*"],
};
