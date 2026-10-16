import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getProject } from "@/lib/projects";
import { DeleteButton, RenameForm } from "../../forms";

export default function ProjetoPage({ params }: PageProps<"/app/projetos/[id]">) {
  return (
    <>
      <p className="small"><Link href="/app" className="muted">← Projetos</Link></p>
      <Suspense fallback={<p className="muted" style={{ marginTop: 16 }}>Carregando…</p>}>
        <Projeto params={params} />
      </Suspense>
    </>
  );
}

async function Projeto({ params }: { params: PageProps<"/app/projetos/[id]">["params"] }) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  return (
    <>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", margin: "12px 0 24px" }}>
        <h1 style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{project.name}</h1>
        <RenameForm id={project.id} name={project.name} />
        <DeleteButton id={project.id} name={project.name} />
      </div>
      <section className="card" style={{ padding: 24 }}>
        <h2>Análise da oferta</h2>
        <p className="muted" style={{ marginTop: 8 }}>
          Em breve você vai colar aqui a URL da oferta e receber a análise, as palavras-chave, os anúncios e a estrutura da campanha.
        </p>
      </section>
    </>
  );
}
