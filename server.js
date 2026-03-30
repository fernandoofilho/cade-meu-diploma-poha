require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const { google } = require('googleapis');

const app = express();
app.use(express.json());
app.use(cors());
app.use(session({
  secret: process.env.SESSION_SECRET || 'cade-meu-diploma-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));
app.use(express.static('public'));

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3001/oauth2callback';

// Mapa de intervalos ativos por sessão
const activeIntervals = {};
// Mapa de oauth2Clients por sessão
const oauthClients = {};

function createOAuthClient() {
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

app.get('/', (req, res) => {
  res.redirect('/login.html');
});

app.get('/auth', (req, res) => {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return res.status(400).json({ error: 'OAuth2 não configurado. Substitua CLIENT_ID e CLIENT_SECRET.' });
  }
  const client = createOAuthClient();
  oauthClients[req.session.id] = client;
  const authUrl = client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/userinfo.email']
  });
  res.redirect(authUrl);
});

app.get('/status', (req, res) => {
  res.json({ authenticated: !!req.session.accessToken });
});

app.get('/profile', (req, res) => {
  if (!req.session.accessToken) {
    return res.status(401).json({ error: 'Não autenticado' });
  }
  res.json({ email: req.session.userEmail });
});

app.post('/logout', (req, res) => {
  const sid = req.session.id;
  if (activeIntervals[sid]) {
    clearInterval(activeIntervals[sid]);
    delete activeIntervals[sid];
  }
  delete oauthClients[sid];
  req.session.destroy(() => {
    res.json({ message: 'Logout realizado' });
  });
});

app.get('/oauth2callback', async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).send('Código de autorização não fornecido.');
  }
  try {
    const client = oauthClients[req.session.id] || createOAuthClient();
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);
    oauthClients[req.session.id] = client;

    req.session.accessToken = tokens.access_token;

    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const userInfo = await oauth2.userinfo.get();
    req.session.userEmail = userInfo.data.email;

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

  const sid = req.session.id;
  const userEmail = req.session.userEmail;
  const client = oauthClients[sid];

  if (!req.session.accessToken || !userEmail || !client) {
    return res.status(401).json({ error: 'Não autenticado. Faça login novamente.' });
  }

  if (activeIntervals[sid]) {
    clearInterval(activeIntervals[sid]);
  }

  const emailBody = `Prezado responsável,

Estou aguardando o meu diploma desde o dia 27 de fevereiro de 2026. Meu nome é ${nome}.

Por favor, informe o status do meu diploma o mais breve possível.

Atenciosamente,
${nome}`;

  const sendEmail = async () => {
    try {
      const gmail = google.gmail({ version: 'v1', auth: client });
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
      console.log(`[${userEmail}] Email enviado com sucesso!`);
    } catch (error) {
      console.log(`[${userEmail}] Erro ao enviar email:`, error.message);
    }
  };

  const intervalMs = tempo * 60 * 1000;
  activeIntervals[sid] = setInterval(sendEmail, intervalMs);
  sendEmail();

  res.json({ message: 'Loop de envio de emails iniciado' });
});

app.post('/stop', (req, res) => {
  if (!req.session.accessToken) {
    return res.status(401).json({ error: 'Não autenticado' });
  }
  const sid = req.session.id;
  if (activeIntervals[sid]) {
    clearInterval(activeIntervals[sid]);
    delete activeIntervals[sid];
    res.json({ message: 'Loop de envio de emails parado' });
  } else {
    res.json({ message: 'Nenhum loop ativo' });
  }
});

app.listen(3001, () => {
  console.log('Servidor rodando na porta 3001');
});
