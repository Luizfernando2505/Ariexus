import type { Metadata } from "next";
import { EMPRESA } from "@/lib/empresa";
import { LegalPage } from "../legal-layout";

export const metadata: Metadata = { title: "Contato" };

export default function ContatoPage() {
  return (
    <LegalPage title="Contato">
      {EMPRESA.email ? (
        <p>
          Fale com a gente pelo e-mail <a href={`mailto:${EMPRESA.email}`}>{EMPRESA.email}</a>. Respondemos em dias úteis.
        </p>
      ) : (
        <p>O canal de contato será publicado aqui em breve.</p>
      )}
      <p>Para pedidos sobre seus dados pessoais, use o mesmo e-mail e indique o endereço da sua conta.</p>
    </LegalPage>
  );
}
