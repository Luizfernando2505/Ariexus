import * as z from "zod/v4";
import { IDIOMAS, PAISES, PERFIS, PLATAFORMAS, TAMANHO_MAXIMO_URL } from "./opcoes";

// Dados que o usuário informa no formulário. Validados no servidor; o navegador só ajuda.

export { IDIOMAS, PAISES, PERFIS, PLATAFORMAS };

const chaves = <T extends Record<string, string>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];

export const DadosOferta = z.object({
  url: z
    .string({ error: "Cole a URL da página de vendas." })
    .trim()
    .min(1, "Cole a URL da página de vendas.")
    .max(TAMANHO_MAXIMO_URL, "Essa URL é longa demais."),
  perfil: z.enum(chaves(PERFIS), { error: "Escolha se você é afiliado ou produtor." }),
  plataforma: z.enum(PLATAFORMAS, { error: "Escolha a plataforma da oferta." }),
  pais: z.enum(chaves(PAISES), { error: "Escolha o país dos anúncios." }),
  idioma: z.enum(chaves(IDIOMAS), { error: "Escolha o idioma dos anúncios." }),
});

export type DadosOferta = z.infer<typeof DadosOferta>;

export function lerFormulario(formData: FormData) {
  const texto = (nome: string) => {
    const v = formData.get(nome);
    return typeof v === "string" ? v : undefined;
  };
  return DadosOferta.safeParse({
    url: texto("url"),
    perfil: texto("perfil"),
    plataforma: texto("plataforma"),
    pais: texto("pais"),
    idioma: texto("idioma"),
  });
}
