# M&E Furação e Corte — deploy no Railway

## 1. Segurança antes de publicar


As credenciais que estavam no pacote original devem ser consideradas expostas e devem ser **rotacionadas** antes do uso em produção:
- senha do administrador;
- senha/URL do banco;
- JWT_SECRET;

## 2. Criar o serviço

1. Crie um projeto no Railway.
2. Escolha **Deploy from GitHub repo** (recomendado) ou envie este projeto para um repositório Git.
3. Railway detectará `railway.json`.
4. O build será `pnpm install --frozen-lockfile && pnpm run build`.
5. O processo será iniciado com `pnpm start`.

## 3. Banco

O projeto usa MySQL/TiDB. Crie um banco compatível e coloque a URL privada em `DATABASE_URL`.

Depois que o serviço estiver conectado ao banco, execute uma vez:

```bash
pnpm drizzle-kit migrate
```

ou use um comando de deploy equivalente no provedor.

## 4. Variáveis

Copie `.env.example` para referência e cadastre os valores **no painel Variables/Secrets do Railway**, nunca no código.

Obrigatórias para o funcionamento completo:

```text
NODE_ENV=production
DATABASE_URL=...
JWT_SECRET=...
ADMIN_USERNAME=...
ADMIN_PASSWORD=...
```


## 5. Domínio

Depois do primeiro deploy, no Railway abra o serviço → **Settings → Networking → Public Networking** e gere um domínio público.

Para usar `me.furacortes.com`, adicione esse domínio personalizado no Railway. O Railway mostrará o registro DNS exato que deverá ser criado no painel onde o domínio foi comprado.

## 6. Painel

Após o deploy:

```text
https://SEU-DOMINIO/gestao
```

Use `ADMIN_USERNAME` e `ADMIN_PASSWORD` configurados nas Variables.

## 7. Observação sobre uploads


## 8. Node

O projeto declara Node.js 22 ou superior em `package.json`.

## Armazenamento de imagens

Esta versão não usa Manus/Forge. Uploads são gravados em `uploads/`. Em Railway, use um Volume montado em `/app/uploads` se quiser que as imagens sobrevivam a novos deploys/reinicializações.
