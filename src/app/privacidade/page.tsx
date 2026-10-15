import type { Metadata } from "next";
import { EMPRESA, pendente } from "@/lib/empresa";
import { LegalPage } from "../legal-layout";

export const metadata: Metadata = { title: "Política de Privacidade" };

export default function PrivacidadePage() {
  return (
    <LegalPage title="Política de Privacidade">
      <p>
        Esta política explica quais dados a Ariexus trata e por quê, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018).
        Controlador: {pendente(EMPRESA.responsavel)} ({pendente(EMPRESA.documento)}).
      </p>
      <h2>Dados que coletamos</h2>
      <ul>
        <li><strong>Conta:</strong> seu e-mail, usado para login e para avisos sobre o serviço.</li>
        <li><strong>Projetos:</strong> nomes, URLs de ofertas e o material gerado, para você salvar e retomar o trabalho.</li>
        <li><strong>Uso técnico:</strong> registros de acesso e de erro, para segurança e para manter o serviço funcionando.</li>
      </ul>
      <p>Não vendemos seus dados e não usamos o conteúdo dos seus projetos para publicidade.</p>
      <h2>Com quem compartilhamos</h2>
      <ul>
        <li>Supabase (banco de dados e login) e Vercel (hospedagem), que processam dados em nosso nome.</li>
        <li>Anthropic (inteligência artificial), quando você pedir uma análise: enviamos o conteúdo da oferta e o seu pedido.</li>
      </ul>
      <p>Esses fornecedores podem armazenar dados fora do Brasil, com as salvaguardas previstas na LGPD.</p>
      <h2>Bases legais</h2>
      <p>Execução do contrato (prestar o serviço), legítimo interesse (segurança e melhoria) e cumprimento de obrigação legal.</p>
      <h2>Por quanto tempo</h2>
      <p>Enquanto sua conta existir. Ao excluir a conta, apagamos seus dados em até 30 dias, salvo obrigação legal de guarda.</p>
      <h2>Seus direitos</h2>
      <p>
        Você pode pedir acesso, correção, exportação ou exclusão dos seus dados, e tirar dúvidas, pelo e-mail {pendente(EMPRESA.email)}.
      </p>
      <h2>Cookies</h2>
      <p>Usamos apenas cookies necessários para manter você conectado. Não usamos cookies de publicidade.</p>
    </LegalPage>
  );
}
