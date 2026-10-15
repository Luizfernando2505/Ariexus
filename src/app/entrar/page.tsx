import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default function EntrarPage({ searchParams }: PageProps<"/entrar">) {
  return (
    <main className="page-narrow" style={{ maxWidth: 420 }}>
      <header>
        <Link href="/" className="wordmark"><i />Ariexus</Link>
      </header>
      <h1>Entrar</h1>
      <p className="muted" style={{ margin: "8px 0 24px" }}>
        Enviamos um link de acesso para o seu e-mail. Sem senha.
      </p>
      <Suspense fallback={null}>
        <Form searchParams={searchParams} />
      </Suspense>
      <p className="small muted" style={{ marginTop: 24 }}>
        Ao entrar, você concorda com os <Link href="/termos">Termos de Uso</Link> e a{" "}
        <Link href="/privacidade">Política de Privacidade</Link>.
      </p>
    </main>
  );
}

async function Form({ searchParams }: { searchParams: PageProps<"/entrar">["searchParams"] }) {
  const { erro } = await searchParams;
  return <LoginForm linkError={erro === "link"} />;
}
