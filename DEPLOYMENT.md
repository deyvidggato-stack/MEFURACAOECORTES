# M&E Furação e Corte — guia de publicação

## Pacote pronto para deploy

Este projeto é uma aplicação **React/Vite + Node.js/Express + tRPC + MySQL/TiDB**. Portanto, deve ser publicado em um serviço que execute Node.js; não é um site estático puro.

O pacote foi preparado para deploy externo e inclui:
- `railway.json` para build/start no Railway;
- `.env.example` com todas as variáveis esperadas, sem valores secretos;
- `.railwayignore` para impedir envio acidental de arquivos sensíveis;
- `README-DEPLOY-RAILWAY.md` com o passo a passo;
- migrações Drizzle em `drizzle/`.

## Segurança

O pacote original continha credenciais do ambiente de desenvolvimento. Elas foram removidas desta versão preparada para deploy. **Considere as credenciais antigas comprometidas e faça a rotação antes de colocar o sistema em produção.**

Nunca publique `.env`, `.project-config.json`, arquivos de acesso ou senhas no Git.

## Requisitos

- Node.js 22+
- pnpm 10 (Railway pode usar o `packageManager` declarado no `package.json`)
- MySQL ou TiDB
- Storage compatível com o helper usado pelo projeto, para uploads
- HTTPS/domínio recomendado

## Variáveis de ambiente

Consulte `.env.example`. As principais são:

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=mysql://usuario:senha@host:3306/banco
DRIZZLE_DATABASE_URL=mysql://usuario:senha@host:3306/banco
JWT_SECRET=uma-chave-longa-e-aleatoria
ADMIN_USERNAME=emanuel
ADMIN_PASSWORD=uma-senha-forte
OWNER_OPEN_ID=seu_owner_open_id
VITE_APP_ID=seu_app_id
```

Os valores reais devem ficar somente nas Variables/Secrets do provedor.

## Build e execução

```bash
pnpm install --frozen-lockfile
pnpm drizzle-kit migrate
pnpm check
pnpm test
pnpm run build
pnpm start
```

O servidor usa `PORT` quando fornecida pelo provedor.

## Railway

O `railway.json` já define:

- build: `pnpm install --frozen-lockfile && pnpm run build`
- start: `pnpm start`

Depois de conectar o banco e cadastrar as variáveis, publique o serviço e configure o domínio personalizado.

## Painel administrativo

Acesse:

```text
https://seu-dominio/gestao
```

O usuário e senha vêm de `ADMIN_USERNAME` e `ADMIN_PASSWORD`.

## Banco e storage

Antes de produção, execute as migrações do diretório `drizzle/`. As imagens cadastradas no storage antigo não são automaticamente migradas para um novo storage; caso o storage mude, será necessário migrar os arquivos e referências `imageUrl`/`imageKey`.
