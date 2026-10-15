import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";

export default function AppLayout({ children }: LayoutProps<"/app">) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <Link href="/app" className="wordmark"><i />Ariexus</Link>
        <nav aria-label="Principal">
          <Link href="/app">Projetos</Link>
          <span title="Chega na Fase 2">Analisar produto (em breve)</span>
        </nav>
        <footer>
          <Suspense fallback={null}>
            <UserEmail />
          </Suspense>
          <form action="/auth/sair" method="post">
            <button className="btn btn-ghost btn-sm">Sair</button>
          </form>
        </footer>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}

async function UserEmail() {
  const user = await requireUser();
  return <span className="small muted" style={{ overflowWrap: "anywhere" }}>{user.email}</span>;
}
