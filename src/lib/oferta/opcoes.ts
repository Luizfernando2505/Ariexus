// Opções do formulário de análise. Só constantes: pode ser importado pela tela no navegador.

export const TAMANHO_MAXIMO_URL = 2048;

export const PERFIS = { afiliado: "Afiliado", produtor: "Produtor" } as const;

export const PLATAFORMAS = [
  "Hotmart",
  "Kiwify",
  "Eduzz",
  "Monetizze",
  "Braip",
  "Perfect Pay",
  "Ticto",
  "Lastlink",
  "Outra",
] as const;

export const PAISES = {
  BR: "Brasil",
  PT: "Portugal",
  US: "Estados Unidos",
  MX: "México",
  ES: "Espanha",
  AR: "Argentina",
  CO: "Colômbia",
  CL: "Chile",
} as const;

export const IDIOMAS = { "pt-BR": "Português", es: "Espanhol", en: "Inglês" } as const;
