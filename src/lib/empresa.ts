// Dados de contato e do responsável, exibidos nas páginas legais.
// PREENCHER antes de abrir o beta: as páginas mostram um aviso enquanto estiverem vazios.
export const EMPRESA = {
  nome: "Ariexus",
  responsavel: "", // razão social ou nome do responsável
  documento: "", // CNPJ ou CPF
  email: "", // e-mail de contato e de privacidade (LGPD)
  atualizadoEm: "15 de outubro de 2026",
};

export const pendente = (valor: string) => valor || "[a definir]";
