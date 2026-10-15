import type { Metadata } from "next";
import { EMPRESA, pendente } from "@/lib/empresa";
import { LegalPage } from "../legal-layout";

export const metadata: Metadata = { title: "Termos de Uso" };

export default function TermosPage() {
  return (
    <LegalPage title="Termos de Uso">
      <p>
        Estes termos valem para o uso da Ariexus, oferecida por {pendente(EMPRESA.responsavel)} ({pendente(EMPRESA.documento)}).
        Ao criar uma conta ou usar o serviço, você concorda com eles.
      </p>
      <h2>1. O que a Ariexus faz</h2>
      <p>
        A Ariexus lê a página de uma oferta indicada por você e gera, com inteligência artificial, sugestões de análise,
        palavras-chave, anúncios e estrutura de campanha para Google Ads e Meta Ads.
      </p>
      <h2>2. Você decide o que publicar</h2>
      <p>
        O material gerado é uma sugestão. Revisar, ajustar e decidir o que publicar é responsabilidade sua, inclusive
        verificar se os anúncios seguem as políticas do Google, da Meta e a legislação aplicável. Não garantimos aprovação
        de anúncios, vendas ou qualquer resultado.
      </p>
      <h2>3. Sua conta</h2>
      <ul>
        <li>O acesso é pessoal. Não compartilhe o link de acesso enviado ao seu e-mail.</li>
        <li>Use apenas URLs de ofertas que você tem direito de divulgar.</li>
        <li>É proibido usar a Ariexus para conteúdo ilegal, enganoso ou que viole direitos de terceiros, ou tentar burlar limites e a segurança do serviço.</li>
      </ul>
      <h2>4. Beta</h2>
      <p>
        Durante o beta, o acesso é gratuito, por convite, e o serviço pode mudar, ficar indisponível ou ter limites de uso.
        Avisaremos antes de começar qualquer cobrança.
      </p>
      <h2>5. Planos e pagamento</h2>
      <p>As condições de cada plano pago serão informadas antes da contratação.</p>
      <h2>6. Encerramento</h2>
      <p>
        Você pode excluir seus projetos a qualquer momento e pedir a exclusão da conta pelo e-mail de contato. Podemos
        suspender contas que descumpram estes termos.
      </p>
      <h2>7. Contato</h2>
      <p>Dúvidas: {pendente(EMPRESA.email)}.</p>
    </LegalPage>
  );
}
