require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static('public'));

let emailInterval;
let oauth2Client;
let accessToken = null;
let userEmail = null;

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3001/oauth2callback';

if (CLIENT_ID && CLIENT_SECRET) {
  oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

app.get('/', (req, res) => {
  res.redirect('/login.html');
});

app.get('/auth', (req, res) => {
  if (!oauth2Client) {
    return res.status(400).json({ error: 'OAuth2 não configurado. Substitua CLIENT_ID e CLIENT_SECRET.' });
  }
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/userinfo.email']
  });
  res.redirect(authUrl);
});

app.get('/status', (req, res) => {
  res.json({ authenticated: accessToken !== null });
});

app.get('/profile', (req, res) => {
  if (!accessToken) {
    return res.status(401).json({ error: 'Não autenticado' });
  }
  res.json({ email: userEmail });
});

app.post('/logout', (req, res) => {
  accessToken = null;
  userEmail = null;
  oauth2Client = null;
  if (CLIENT_ID && CLIENT_SECRET) {
    oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
  }
  res.json({ message: 'Logout realizado' });
});

app.get('/oauth2callback', async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).send('Código de autorização não fornecido.');
  }
  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    accessToken = tokens.access_token;
    
    // Obter email do usuário
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    userEmail = userInfo.data.email;
    
    res.redirect('/dashboard.html');
  } catch (error) {
    console.error('Erro na autenticação:', error);
    res.status(500).send('Erro na autenticação.');
  }
});

app.post('/start', (req, res) => {
  const { tempo, nome, destino } = req.body;

  if (!tempo || !nome || !destino) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
  }

  if (!accessToken || !userEmail) {
    return res.status(401).json({ error: 'Não autenticado. Faça login novamente.' });
  }

  const emailBody = `Prezado responsável,

Estou aguardando o meu diploma desde o dia 27 de fevereiro de 2026. Meu nome é ${nome}.

Por favor, informe o status do meu diploma o mais breve possível.

Atenciosamente,
${nome}`;

  // Função para enviar email via Gmail API (sem SMTP)
  const sendEmail = async () => {
    try {
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      const rawMessage = [
        `From: ${userEmail}`,
        `To: ${destino}`,
        `Subject: Cobranca sobre Diploma de conclusao de curso`,
        `Content-Type: text/plain; charset=utf-8`,
        ``,
        emailBody
      ].join('\n');

      const encodedMessage = Buffer.from(rawMessage).toString('base64url');
      await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw: encodedMessage }
      });
      console.log('Email enviado com sucesso!');
    } catch (error) {
      console.log('Erro ao enviar email:', error.message);
    }
  };

  // Iniciar loop
  const intervalMs = tempo * 60 * 1000; // Converter minutos para ms
  emailInterval = setInterval(sendEmail, intervalMs);

  // Enviar primeiro email imediatamente
  sendEmail();

  res.json({ message: 'Loop de envio de emails iniciado' });
});

app.post('/stop', (req, res) => {
  if (!accessToken) {
    return res.status(401).json({ error: 'Não autenticado' });
  }
  if (emailInterval) {
    clearInterval(emailInterval);
    emailInterval = null;
    res.json({ message: 'Loop de envio de emails parado' });
  } else {
    res.json({ message: 'Nenhum loop ativo' });
  }
});

app.listen(3001, () => {
  console.log('Servidor rodando na porta 3001');
});