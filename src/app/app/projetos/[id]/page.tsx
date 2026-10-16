import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { buscarAnalise, consultarUso, listarAnalises, type ResumoAnalise } from "@/lib/analises";
import { modoAnalise } from "@/lib/oferta/provedores";
import { getProject } from "@/lib/projects";
import { DeleteButton, RenameForm } from "../../forms";
import { AnaliseForm } from "./analise-form";
import { Resultado, SeloModo } from "./resultado";

// Vale para as Server Actions desta página: leitura (até 10 s) + modelo (até 2 min, com uma nova tentativa).
export const maxDuration = 300;

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

const data = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

async function Projeto({ params }: { params: PageProps<"/app/projetos/[id]">["params"] }) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const modo = modoAnalise();
  // Se as análises não carregarem (por exemplo, banco sem a migração 0002), o projeto continua abrindo.
  let historico: ResumoAnalise[] = [];
  let ultima: Awaited<ReturnType<typeof buscarAnalise>> = null;
  let falhou = false;
  try {
    historico = await listarAnalises(project.id);
    ultima = historico[0] ? await buscarAnalise(project.id, historico[0].id) : null;
  } catch {
    falhou = true;
  }
  const uso = await consultarUso();

  return (
    <>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", margin: "12px 0 24px" }}>
        <h1 style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{project.name}</h1>
        <RenameForm id={project.id} name={project.name} />
        <DeleteButton id={project.id} name={project.name} />
      </div>

      <section className="card" style={{ padding: 24 }}>
        <h2>Análise da oferta</h2>
        <p className="muted" style={{ margin: "6px 0 16px" }}>
          Cole a URL da página de vendas. A Ariexus lê a página e separa o que está escrito nela do que é dedução.
        </p>
        <AvisoModo modo={modo} />
        <AnaliseForm projeto={project.id} modo={modo} padrao={ultima?.entrada ?? null} />
        {uso && (
          <p className="small muted" style={{ marginTop: 12 }}>
            {modo !== "desligado" && <>Análises este mês: {uso.analisesUsadas} de {uso.analisesLimite} · </>}
            Leituras na última hora: {uso.leiturasUsadas} de {uso.leiturasLimite}
          </p>
        )}
      </section>

      {falhou && (
        <p className="alert alert-error" style={{ marginTop: 24 }}>Não foi possível carregar as análises deste projeto. Tente de novo.</p>
      )}

      {ultima && (
        <div style={{ marginTop: 24 }}>
          <Resultado analise={ultima} projeto={project.id} />
        </div>
      )}

      {historico.length > 1 && <Historico projeto={project.id} itens={historico.slice(1)} />}
    </>
  );
}

function AvisoModo({ modo }: { modo: ReturnType<typeof modoAnalise> }) {
  if (modo === "desligado") {
    return (
      <p className="alert alert-ok" style={{ marginBottom: 16 }}>
        A análise por IA ainda não está ligada. Por enquanto a Ariexus lê a página e mostra o que encontrou, sem análise.
      </p>
    );
  }
  if (modo === "simulado") {
    return (
      <p className="alert alert-simulacao" style={{ marginBottom: 16 }}>
        <strong>Ambiente de teste.</strong> A IA está desligada e o resultado será uma SIMULAÇÃO, sem custo. A leitura da página é real.
      </p>
    );
  }
  return null;
}

function Historico({ projeto, itens }: { projeto: string; itens: ResumoAnalise[] }) {
  return (
    <section style={{ marginTop: 32 }}>
      <h2>Análises anteriores</h2>
      <ul className="project-list">
        {itens.map((a) => (
          <li key={a.id} className="card project-row">
            <Link href={`/app/projetos/${projeto}/analises/${a.id}`} className="name">
              {a.titulo ?? a.url_final}
            </Link>
            <SeloModo modo={a.modo} />
            <span className="small muted">{data.format(new Date(a.created_at))}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
