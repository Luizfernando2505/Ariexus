# Ariexus

Cole a URL da oferta. Receba a campanha estruturada.

App em Next.js + TypeScript, com Supabase (a partir da Fase 1) e deploy na Vercel. O plano completo está no documento "Plano do MVP Ariexus".

## Rodar localmente

Requer Node 22 (veja `.nvmrc`) e Docker (para o Supabase local).

```bash
npm ci
npx supabase start -x studio,realtime,storage-api,imgproxy,edge-runtime,logflare,vector,supavisor,postgres-meta
cp .env.example .env.local   # preencha com a URL e a PUBLISHABLE_KEY que o comando acima mostrou
npm run dev                  # http://localhost:3000
```

Para entrar localmente, crie um usuário no Supabase local e peça o link em `/entrar`. O e-mail chega no Mailpit, em http://127.0.0.1:54324.

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `npm start` | Build e servidor de produção |
| `npm run lint` | ESLint |
| `npm run typecheck` | Checagem de tipos do TypeScript |
| `npm test` | Testes: isolamento entre usuários no banco (RLS), limites de uso, proteção de URL, leitura, extração e conferência da análise |
| `npm run check:landing [url]` | Confere se a landing aprovada está intacta (arquivo e, opcionalmente, o HTML servido em `url`) |

## A landing aprovada

A landing é o arquivo `public/landing.html`, cópia exata do `index.html` aprovado, servida em `/` por um rewrite em `next.config.ts`. Ela continua em HTML, CSS e JS puros: convertê-la para React mudaria código aprovado sem ganho para o MVP.

O hash SHA-256 aprovado fica em `landing.sha256`, e o CI falha se o arquivo ou o HTML servido mudar. Para aprovar uma nova versão da landing, atualize os dois no mesmo commit.

## Segurança já configurada

- Cabeçalhos em todas as rotas: HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` e, em produção, Content-Security-Policy restrita aos hosts que a landing usa.
- Nenhum segredo no repositório: `.env*` fica fora do git, e o CI roda o gitleaks.
- `GET /api/health` responde `{"status":"ok"}` para checagens de deploy.

## Contas e projetos (Fase 1)

- Login por link mágico no e-mail (`/entrar`), sem senha. Beta fechado: só entra quem foi cadastrado em Authentication > Users no Supabase.
- Área logada em `/app`: listar, criar, abrir, renomear e excluir projetos.
- Banco em `supabase/migrations/`. Cada usuário só lê e altera os próprios projetos, regra garantida pelo RLS e testada em `tests/rls.test.ts`.
- Páginas legais: `/termos`, `/privacidade`, `/contato`. Os dados da empresa ficam em `src/lib/empresa.ts`.

## Análise da oferta (Fase 2)

No projeto, a pessoa cola a URL da página de vendas e escolhe perfil, plataforma, país e idioma. O caminho, em `src/lib/oferta/`:

1. **URL** (`url.ts`): só http/https públicos. IPs internos, nomes de rede local, portas fora de 80/443 e usuário:senha na URL são recusados.
2. **Leitura** (`ler-pagina.ts`): no nosso servidor, até 10 s, 2 MB e 3 redirecionamentos (cada um conferido de novo). O IP é conferido na hora da conexão, o que barra DNS que aponta para dentro da rede.
3. **Extração** (`extrair.ts`): texto com títulos, listas, botões e descrição das imagens; preços e frase de garantia. Menos de 150 palavras para aqui, sem chamar IA.
4. **Análise** (`provedores/`): produto, público, promessa, provas, alertas e lacunas. Cada item diz se está **na página** (com o trecho) ou é **inferência** (com o motivo).
5. **Conferência** (`evidencias.ts`): cada trecho citado é procurado no texto lido. O que não for encontrado vira inferência; prova sem trecho é descartada.
6. **Salvamento** na tabela `analyses`, com tokens e custo quando houver IA.

Modo da análise (variável `ANALISE_PROVEDOR`, só no servidor):

| Modo | Quando | O que faz |
| --- | --- | --- |
| `desligado` | padrão em produção | Lê a página e mostra o que encontrou, sem análise. Não gasta a cota de análises. |
| `simulado` | padrão fora da produção (dev, previews) | Resultado montado por regras simples, marcado como SIMULAÇÃO, sem custo. Nunca liga em produção. |
| `anthropic` | só com `ANALISE_PROVEDOR=anthropic` **e** `ANTHROPIC_API_KEY` | Chama o modelo (gera custo). Hoje desligado. |

Limites por plano na tabela `plan_limits` (beta: 10 análises por mês e 30 leituras por hora), contados pela função `registrar_uso`, que o usuário não consegue burlar.

**Antes de usar em um ambiente novo:** rode `supabase/migrations/0002_analises.sql` no SQL Editor do Supabase.

## Deploy na Vercel

1. Importe o repositório em vercel.com/new (o framework Next.js é detectado sozinho).
2. Configure `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (ou `_ANON_KEY`).
3. Use o plano Pro antes de cobrar clientes: o Hobby é só para uso pessoal, não comercial.
