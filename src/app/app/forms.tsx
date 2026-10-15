"use client";

import { useActionState, useState } from "react";
import { createProject, deleteProject, renameProject, type FormState } from "./actions";

const initial: FormState = {};

export function NewProjectForm() {
  const [state, action, pending] = useActionState(createProject, initial);
  return (
    <form action={action} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <input name="name" className="input" style={{ flex: "1 1 240px" }} placeholder="Nome da oferta, por exemplo Curso de fotografia" maxLength={120} required aria-label="Nome do projeto" />
      <button className="btn" disabled={pending}>{pending ? "Criando…" : "Novo projeto"}</button>
      {state.error && <p className="alert alert-error" style={{ flexBasis: "100%" }}>{state.error}</p>}
    </form>
  );
}

export function RenameForm({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const result = await renameProject(prev, fd);
    if (!result.error) setOpen(false);
    return result;
  }, initial);

  if (!open) {
    return <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>Renomear</button>;
  }
  return (
    <form action={action} style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
      <input type="hidden" name="id" value={id} />
      <input name="name" defaultValue={name} className="input" style={{ height: 32, width: 220 }} maxLength={120} required aria-label="Novo nome" autoFocus />
      <button className="btn btn-sm" disabled={pending}>Salvar</button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancelar</button>
      {state.error && <span className="small" style={{ color: "var(--danger)" }}>{state.error}</span>}
    </form>
  );
}

export function DeleteButton({ id, name }: { id: string; name: string }) {
  return (
    <form
      action={deleteProject}
      onSubmit={(e) => {
        if (!confirm(`Excluir "${name}"? Isso não pode ser desfeito.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button className="btn btn-danger btn-sm">Excluir</button>
    </form>
  );
}
