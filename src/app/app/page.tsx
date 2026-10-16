import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { listProjects } from "@/lib/projects";
import { DeleteButton, NewProjectForm, RenameForm } from "./forms";

export const metadata: Metadata = { title: "Projetos" };

export default function ProjetosPage() {
  return (
    <>
      <h1>Projetos</h1>
      <p className="muted" style={{ margin: "6px 0 24px" }}>Cada oferta que você analisar vira um projeto salvo aqui.</p>
      <NewProjectForm />
      <Suspense fallback={<p className="muted" style={{ marginTop: 24 }}>Carregando projetos…</p>}>
        <ProjectList />
      </Suspense>
    </>
  );
}

const dateFmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

async function ProjectList() {
  const projects = await listProjects();
  if (projects.length === 0) {
    return <p className="muted" style={{ marginTop: 32 }}>Nenhum projeto ainda. Crie o primeiro acima.</p>;
  }
  return (
    <ul className="project-list">
      {projects.map((p) => (
        <li key={p.id} className="card project-row">
          <Link href={`/app/projetos/${p.id}`} className="name">{p.name}</Link>
          <span className="small muted">Atualizado {dateFmt.format(new Date(p.updated_at))}</span>
          <div className="row-actions">
            <RenameForm id={p.id} name={p.name} />
            <DeleteButton id={p.id} name={p.name} />
          </div>
        </li>
      ))}
    </ul>
  );
}
