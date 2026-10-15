"use client";

import { useActionState } from "react";
import { sendMagicLink, type LoginState } from "./actions";

const initial: LoginState = { status: "idle" };

export function LoginForm({ linkError }: { linkError: boolean }) {
  const [state, action, pending] = useActionState(sendMagicLink, initial);

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {linkError && state.status === "idle" && (
        <p className="alert alert-error">Esse link expirou ou já foi usado. Peça um novo abaixo.</p>
      )}
      <label htmlFor="email" className="small muted">E-mail</label>
      <input id="email" name="email" type="email" required autoComplete="email" className="input" placeholder="voce@exemplo.com" />
      <button className="btn" type="submit" disabled={pending}>
        {pending ? "Enviando…" : "Receber link de acesso"}
      </button>
      {state.message && (
        <p className={`alert ${state.status === "error" ? "alert-error" : "alert-ok"}`} role="status">
          {state.message}
        </p>
      )}
    </form>
  );
}
