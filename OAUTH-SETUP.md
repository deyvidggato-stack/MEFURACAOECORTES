# Login com Google e Facebook

O projeto agora possui o fluxo OAuth para o login do atendimento online.

## 1. Variáveis de ambiente

Copie `.env.example` para `.env` e preencha:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `FACEBOOK_APP_ID`
- `FACEBOOK_APP_SECRET`
- `OAUTH_BASE_URL` com a URL pública do site

Exemplo em produção:

`OAUTH_BASE_URL=https://seudominio.com`

## 2. Google

No Google Cloud Console, crie um OAuth Client ID do tipo Web application.
Adicione exatamente estas URLs em Authorized redirect URIs:

`https://seudominio.com/api/auth/google/callback`

Para desenvolvimento local:

`http://localhost:3000/api/auth/google/callback`

## 3. Facebook

No Meta for Developers, crie/configure um app com Facebook Login.
Cadastre exatamente:

`https://seudominio.com/api/auth/facebook/callback`

Para desenvolvimento local:

`http://localhost:3000/api/auth/facebook/callback`

O aplicativo precisa permitir o escopo `email` quando disponível.

## 4. Como funciona

Depois do login, o servidor cria ou reutiliza o cadastro do cliente no atendimento e inicia a conversa. O token do atendimento é entregue por cookie HttpOnly e convertido para a sessão local do chat.

Os segredos OAuth ficam somente no servidor; nunca coloque `GOOGLE_CLIENT_SECRET` ou `FACEBOOK_APP_SECRET` no código do navegador.
