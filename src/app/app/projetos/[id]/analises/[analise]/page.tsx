import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { buscarAnalise } from "@/lib/analises";
import { Resultado } from "../../resultado";

type Props = PageProps<"/app/projetos/[id]/analises/[analise]">;

export default function AnalisePage({ params }: Props) {
  return (
    <Suspense fallback={<p className="muted">Carregando…</p>}>
      <Analise params={params} />
    </Suspense>
  );
}

async function Analise({ params }: { params: Props["params"] }) {
  const { id, analise } = await params;
  const encontrada = await buscarAnalise(id, analise);
  if (!encontrada) notFound();

  return (
    <>
      <p className="small" style={{ marginBottom: 16 }}>
        <Link href={`/app/projetos/${id}`} className="muted">← Voltar ao projeto</Link>
      </p>
      <Resultado analise={encontrada} projeto={id} />
    </>
  );
}
