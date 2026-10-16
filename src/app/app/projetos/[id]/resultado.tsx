import type { AnaliseCompleta } from "@/lib/analises";
import type { Item, Prova } from "@/lib/oferta/schema";
import { excluirAnalise } from "./actions";

// Mostra uma análise salva. Cada item diz de onde veio: escrito na página (com o trecho) ou deduzido (com o motivo).

const data = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

const CATEGORIA: Record<Prova["categoria"], string> = {
  depoimento: "Depoimento",
  numero: "Número",
  autoridade: "Autoridade",
  garantia: "Garantia",
  demonstracao: "Demonstração",
  midia: "Mídia",
  certificacao: "Certificação",
  outra: "Outra",
};

/** Só mostra como link endereços http(s). */
function linkSeguro(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
}

export function SeloModo({ modo }: { modo: AnaliseCompleta["modo"] }) {
  if (modo === "simulado") return <span className="selo selo-simulacao">Simulação</span>;
  if (modo === "desligado") return <span className="selo">Só leitura</span>;
  return <span className="selo selo-ia">IA</span>;
}

export function Resultado({ analise, projeto }: { analise: AnaliseCompleta; projeto: string }) {
  const href = linkSeguro(analise.url_final);
  const p = analise.pagina;
  const r = analise.resultado;

  return (
    <article className="card resultado">
      <header className="resultado-topo">
        <div style={{ minWidth: 0, flex: 1 }}>
          <h2 style={{ overflowWrap: "anywhere" }}>{analise.titulo ?? "Página sem título"}</h2>
          <p className="small muted" style={{ overflowWrap: "anywhere" }}>
            {href ? (
              <a href={href} target="_blank" rel="noopener noreferrer nofollow">{analise.url_final}</a>
            ) : (
              analise.url_final
            )}
            {" · "}
            {data.format(new Date(analise.created_at))}
          </p>
        </div>
        <SeloModo modo={analise.modo} />
      </header>

      {analise.modo === "simulado" && (
        <p className="alert alert-simulacao">
          <strong>SIMULAÇÃO.</strong> A IA está desligada. Este resultado foi montado por regras simples, sem custo, só para
          testar a tela e o salvamento. Ele não é uma análise da oferta.
        </p>
      )}

      {analise.ilegivel && <p className="alert alert-error">Esta análise foi salva num formato que a tela não reconhece.</p>}

      {p && p.avisos.length > 0 && (
        <ul className="avisos">
          {p.avisos.map((a) => <li key={a}>{a}</li>)}
        </ul>
      )}

      {analise.status === "somente_leitura" && p && <Leitura pagina={p} />}

      {r && (
        <>
          <p className="small muted">
            {r.cobertura.pagina} {r.cobertura.pagina === 1 ? "item tirado" : "itens tirados"} da página,{" "}
            {r.cobertura.inferencia} {r.cobertura.inferencia === 1 ? "deduzido" : "deduzidos"} e {r.cobertura.vazios}{" "}
            {r.cobertura.vazios === 1 ? "campo sem informação" : "campos sem informação"} na página.
          </p>

          <Secao titulo="Produto">
            <Campo rotulo="Nome" item={r.produto.nome} />
            <Campo rotulo="Tipo" item={r.produto.tipo} />
            <Campo rotulo="O que entrega" item={r.produto.resumo} />
            <Campo rotulo="Preço" item={r.produto.preco} />
            <Campo rotulo="Garantia" item={r.produto.garantia} />
            <Lista rotulo="Bônus" itens={r.produto.bonus} />
          </Secao>

          <Secao titulo="Público">
            <Lista rotulo="Perfis" itens={r.publico.perfis} />
            <Lista rotulo="Dores" itens={r.publico.dores} />
            <Lista rotulo="Desejos" itens={r.publico.desejos} />
            <Lista rotulo="Objeções" itens={r.publico.objecoes} />
          </Secao>

          <Secao titulo="Promessa">
            <Campo rotulo="Principal" item={r.promessa.principal} />
            <Campo rotulo="Mecanismo" item={r.promessa.mecanismo} />
            <Campo rotulo="Prazo" item={r.promessa.prazo} />
            <Lista rotulo="Benefícios" itens={r.promessa.beneficios} />
          </Secao>

          <Secao titulo="Provas">
            {r.provas.length === 0 ? (
              <p className="muted small">Nenhuma prova escrita encontrada na página.</p>
            ) : (
              <ul className="itens">
                {r.provas.map((prova, i) => (
                  <li key={i}>
                    <div className="item-linha">
                      <span>{prova.texto}</span>
                      <span className="selo selo-pagina">{CATEGORIA[prova.categoria]}</span>
                    </div>
                    <q className="trecho">{prova.trecho}</q>
                  </li>
                ))}
              </ul>
            )}
          </Secao>

          {r.alertas.length > 0 && (
            <Secao titulo="Pontos de atenção">
              <ul className="itens">
                {r.alertas.map((a, i) => (
                  <li key={i} className={a.severidade === "atencao" ? "alerta-atencao" : undefined}>
                    {a.texto}
                    {a.origem === "sistema" && <span className="small muted"> (conferência automática)</span>}
                  </li>
                ))}
              </ul>
            </Secao>
          )}

          {r.lacunas.length > 0 && (
            <Secao titulo="O que a página não deixou claro">
              <ul className="itens">
                {r.lacunas.map((l, i) => <li key={i}>{l}</li>)}
              </ul>
            </Secao>
          )}
        </>
      )}

      <details className="texto-lido">
        <summary>Ver o texto lido da página</summary>
        <pre>{analise.texto_pagina}</pre>
      </details>

      <footer className="resultado-rodape">
        <span className="small muted">
          {analise.modo === "anthropic" && analise.modelo
            ? `Modelo ${analise.modelo}${analise.custo_usd !== null ? ` · custo calculado US$ ${analise.custo_usd.toFixed(4)}` : ""}`
            : null}
        </span>
        <form action={excluirAnalise}>
          <input type="hidden" name="projeto" value={projeto} />
          <input type="hidden" name="analise" value={analise.id} />
          <button className="btn btn-danger btn-sm">Excluir análise</button>
        </form>
      </footer>
    </article>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="secao">
      <h3>{titulo}</h3>
      {children}
    </section>
  );
}

function Origem({ item }: { item: Item }) {
  return item.fonte === "pagina" ? (
    <span className="selo selo-pagina">Na página</span>
  ) : (
    <span className="selo selo-inferencia">Inferência</span>
  );
}

function Detalhe({ item }: { item: Item }) {
  if (item.fonte === "pagina") return item.trecho ? <q className="trecho">{item.trecho}</q> : null;
  return item.motivo ? <span className="motivo">{item.motivo}</span> : null;
}

function Campo({ rotulo, item }: { rotulo: string; item: Item | null }) {
  return (
    <div className="campo-resultado">
      <span className="rotulo">{rotulo}</span>
      {item ? (
        <div>
          <div className="item-linha">
            <span>{item.texto}</span>
            <Origem item={item} />
          </div>
          <Detalhe item={item} />
        </div>
      ) : (
        <span className="muted">Não encontrado na página</span>
      )}
    </div>
  );
}

function Lista({ rotulo, itens }: { rotulo: string; itens: Item[] }) {
  return (
    <div className="campo-resultado">
      <span className="rotulo">{rotulo}</span>
      {itens.length === 0 ? (
        <span className="muted">Não encontrado na página</span>
      ) : (
        <ul className="itens">
          {itens.map((item, i) => (
            <li key={i}>
              <div className="item-linha">
                <span>{item.texto}</span>
                <Origem item={item} />
              </div>
              <Detalhe item={item} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Leitura({ pagina }: { pagina: NonNullable<AnaliseCompleta["pagina"]> }) {
  return (
    <>
      <p className="alert alert-ok">
        A análise por IA ainda não está ligada. Abaixo está o que a Ariexus conseguiu ler da página.
      </p>
      <Secao titulo="O que foi lido">
        <dl className="lido">
          <dt>Título</dt>
          <dd>{pagina.titulo ?? <span className="muted">Sem título</span>}</dd>
          <dt>Descrição</dt>
          <dd>{pagina.descricao ?? <span className="muted">Sem descrição</span>}</dd>
          <dt>Preços escritos</dt>
          <dd>{pagina.precos.length ? pagina.precos.join(" · ") : <span className="muted">Nenhum preço em texto</span>}</dd>
          <dt>Garantia</dt>
          <dd>{pagina.garantia ?? <span className="muted">Nenhuma frase sobre garantia</span>}</dd>
          <dt>Tamanho</dt>
          <dd>
            {pagina.palavras.toLocaleString("pt-BR")} palavras, {pagina.imagens} imagens ({pagina.imagensComDescricao} com descrição)
          </dd>
          <dt>Idioma declarado</dt>
          <dd>{pagina.idioma ?? <span className="muted">Não informado</span>}</dd>
        </dl>
      </Secao>
    </>
  );
}
