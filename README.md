# Ariexus

Cole a URL da oferta. Receba a campanha estruturada.

App em Next.js + TypeScript, com Supabase (a partir da Fase 1) e deploy na Vercel. O plano completo está no documento "Plano do MVP Ariexus".

## Rodar localmente

Requer Node 22 (veja `.nvmrc`).

```bash
npm ci
npm run dev        # http://localhost:3000
```

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `npm start` | Build e servidor de produção |
| `npm run lint` | ESLint |
| `npm run typecheck` | Checagem de tipos do TypeScript |
| `npm run check:landing [url]` | Confere se a landing aprovada está intacta (arquivo e, opcionalmente, o HTML servido em `url`) |

## A landing aprovada

A landing é o arquivo `public/landing.html`, cópia exata do `index.html` aprovado, servida em `/` por um rewrite em `next.config.ts`. Ela continua em HTML, CSS e JS puros: convertê-la para React mudaria código aprovado sem ganho para o MVP.

O hash SHA-256 aprovado fica em `landing.sha256`, e o CI falha se o arquivo ou o HTML servido mudar. Para aprovar uma nova versão da landing, atualize os dois no mesmo commit.

## Segurança já configurada

- Cabeçalhos em todas as rotas: HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` e, em produção, Content-Security-Policy restrita aos hosts que a landing usa.
- Nenhum segredo no repositório: `.env*` fica fora do git, e o CI roda o gitleaks.
- `GET /api/health` responde `{"status":"ok"}` para checagens de deploy.

## Deploy na Vercel

1. Importe o repositório em vercel.com/new (o framework Next.js é detectado sozinho).
2. Fase 0 não precisa de variáveis de ambiente.
3. Use o plano Pro antes de cobrar clientes: o Hobby é só para uso pessoal, não comercial.
