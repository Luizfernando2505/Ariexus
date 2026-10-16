"use client";

import { useActionState } from "react";
import type { DadosOferta } from "@/lib/oferta/entrada";
import { IDIOMAS, PAISES, PERFIS, PLATAFORMAS } from "@/lib/oferta/opcoes";
import type { ModoAnalise } from "@/lib/oferta/provedores/tipos";
import { analisarOfertaAction, type EstadoAnalise } from "./actions";

const inicial: EstadoAnalise = {};

export function AnaliseForm({
  projeto,
  modo,
  padrao,
}: {
  projeto: string;
  modo: ModoAnalise;
  /** Dados da última análise do projeto, para repetir ou ajustar sem digitar tudo de novo. */
  padrao: DadosOferta | null;
}) {
  const [estado, acao, pendente] = useActionState(analisarOfertaAction, inicial);
  const v = { ...padrao, ...estado.valores } as Partial<Record<keyof DadosOferta, string>>;

  return (
    <form action={acao} key={estado.tentativa} className="analise-form">
      <input type="hidden" name="projeto" value={projeto} />

      <label className="campo campo-largo">
        <span>URL da página de vendas</span>
        <input
          name="url"
          className="input"
          inputMode="url"
          autoComplete="url"
          placeholder="https://"
          defaultValue={v.url}
          maxLength={2048}
          required
        />
      </label>

      <fieldset className="campo campo-largo">
        <legend>Você é</legend>
        <div className="opcoes">
          {Object.entries(PERFIS).map(([valor, rotulo]) => (
            <label key={valor} className="opcao">
              <input type="radio" name="perfil" value={valor} defaultChecked={(v.perfil ?? "afiliado") === valor} required />
              {rotulo}
            </label>
          ))}
          <label className="opcao opcao-off" title="Chega numa próxima etapa">
            <input type="radio" disabled />
            Builder <span className="selo">Em breve</span>
          </label>
        </div>
      </fieldset>

      <label className="campo">
        <span>Plataforma</span>
        <select name="plataforma" className="input" defaultValue={v.plataforma ?? "Hotmart"}>
          {PLATAFORMAS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </label>

      <label className="campo">
        <span>País dos anúncios</span>
        <select name="pais" className="input" defaultValue={v.pais ?? "BR"}>
          {Object.entries(PAISES).map(([valor, rotulo]) => (
            <option key={valor} value={valor}>{rotulo}</option>
          ))}
        </select>
      </label>

      <label className="campo">
        <span>Idioma dos anúncios</span>
        <select name="idioma" className="input" defaultValue={v.idioma ?? "pt-BR"}>
          {Object.entries(IDIOMAS).map(([valor, rotulo]) => (
            <option key={valor} value={valor}>{rotulo}</option>
          ))}
        </select>
      </label>

      <div className="campo-largo acoes-form">
        <button className="btn" disabled={pendente}>
          {pendente ? "Lendo a página…" : modo === "desligado" ? "Ler a página" : "Analisar oferta"}
        </button>
        {pendente && (
          <span className="small muted" role="status">
            {modo === "anthropic" ? "A análise pode levar até 2 minutos." : "Isso leva alguns segundos."}
          </span>
        )}
      </div>

      {estado.erro && (
        <p className="alert alert-error campo-largo" role="alert">{estado.erro}</p>
      )}
    </form>
  );
}
