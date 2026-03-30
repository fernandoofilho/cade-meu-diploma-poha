# Cade Meu Diploma?

Este projeto envia emails automaticamente para cobrar sobre o status do nosso diploma.

## Configuração do Google OAuth2

Para usar autenticação via Google (mais segura e sem precisar de App Password):

1. Acesse [Google Cloud Console](https://console.cloud.google.com/).
2. Crie um novo projeto ou selecione um existente.
3. Ative a API do Gmail: APIs & Services > Library > Gmail API > Enable.
4. Crie credenciais: APIs & Services > Credentials > Create Credentials > OAuth 2.0 Client IDs.
5. Configure o tipo como "Web application", adicione `http://localhost:3001/oauth2callback` como Authorized redirect URIs.
6. Copie o Client ID e Client Secret.
7. Copie `.env.example` para `.env` e preencha com os valores copiados.

## Como usar

1. Instale as dependências: `npm install`
2. Execute o servidor: `npm start`
3. Abra o navegador em `http://localhost:3001`
4. Clique em "Autenticar com Google" e faça login/autorize no popup.
5. Preencha o formulário com seu email Gmail, tempo em minutos e seu nome.
6. Clique em "Iniciar Envio de Emails" para começar.
7. Os emails serão enviados automaticamente no intervalo definido.
8. Clique em "Parar Envio" para interromper.

**Nota:** Substitua o email destinatário no código (server.js) pelo email correto da unidade responsável.
