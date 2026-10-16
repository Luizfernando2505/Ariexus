import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Só POST: um link ou imagem de outro site não consegue deslogar o usuário.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const destino = request.nextUrl.clone();
  destino.pathname = "/entrar";
  destino.search = "";
  return NextResponse.redirect(destino, { status: 303 });
}
