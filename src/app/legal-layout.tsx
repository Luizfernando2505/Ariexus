import Link from "next/link";
import type { ReactNode } from "react";
import { EMPRESA } from "@/lib/empresa";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="page-narrow">
      <header>
        <Link href="/" className="wordmark"><i />Ariexus</Link>
      </header>
      <h1>{title}</h1>
      <p className="small muted" style={{ margin: "8px 0 24px" }}>Atualizado em {EMPRESA.atualizadoEm}</p>
      <article className="prose">{children}</article>
      <p className="small muted" style={{ marginTop: 40 }}>
        <Link href="/termos">Termos de Uso</Link> · <Link href="/privacidade">Privacidade</Link> · <Link href="/contato">Contato</Link>
      </p>
    </main>
  );
}
