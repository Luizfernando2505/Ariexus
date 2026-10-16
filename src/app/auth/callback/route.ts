import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// O link mágico volta aqui com ?code=. Trocamos o código pela sessão e seguimos para o app.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const destino = request.nextUrl.clone();
  destino.search = "";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      destino.pathname = "/app";
      return NextResponse.redirect(destino);
    }
  }

  destino.pathname = "/entrar";
  destino.searchParams.set("erro", "link");
  return NextResponse.redirect(destino);
}
