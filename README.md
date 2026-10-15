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
| `npm test` | Testes, incluindo o de isolamento entre usuários no banco (RLS) |
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

## Deploy na Vercel

1. Importe o repositório em vercel.com/new (o framework Next.js é detectado sozinho).
2. Configure `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (ou `_ANON_KEY`).
3. Use o plano Pro antes de cobrar clientes: o Hobby é só para uso pessoal, não comercial.
