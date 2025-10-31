// server.js
const express = require('express');
const { google } = require('googleapis');
const app = express();

app.use(express.json());

// Headers CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Configurações
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const GOOGLE_CREDENTIALS = JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}');

// Autenticação Google Sheets
const auth = new google.auth.GoogleAuth({
  credentials: GOOGLE_CREDENTIALS,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

// Função para adicionar dados na planilha
async function adicionarNaPlanilha(dados) {
  const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  
  let valores = [
    timestamp, 
    dados.eventID || '', 
    dados.name || dados.user || '', 
    dados.number || '', 
    dados.eventDetails ? JSON.stringify(dados.eventDetails) : '',
    dados.labels && dados.labels.length > 0 ? dados.labels.map(l => l.name).join(', ') : ''
  ];
  
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Eventos!A:F',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [valores],
      },
    });
    
    console.log(`✅ Dados salvos: ${dados.eventID} - ${dados.name || dados.user}`);
    return true;
  } catch (error) {
    console.error('❌ Erro ao salvar na planilha:', error.message);
    throw error;
  }
}

// Rota principal do webhook - aceita com ou sem IDs no path
app.post('/webhook', async (req, res) => {
  console.log('📩 Webhook recebido em /webhook');
  console.log('Dados:', JSON.stringify(req.body, null, 2));
  
  res.status(200).json({ success: true, message: 'Recebido!' });
  
  try {
    const dados = req.body;
    if (dados.eventID) {
      await adicionarNaPlanilha(dados);
      console.log('✅ Processamento completo!');
    }
  } catch (error) {
    console.error('❌ Erro:', error);
  }
});

// Rota com IDs (igual ao fiqon)
app.post('/webhook/:id1/:id2', async (req, res) => {
  console.log('📩 Webhook recebido em /webhook/:id1/:id2');
  console.log('IDs:', req.params.id1, req.params.id2);
  console.log('Dados:', JSON.stringify(req.body, null, 2));
  
  res.status(200).json({ success: true, message: 'Recebido!' });
  
  try {
    const dados = req.body;
    if (dados.eventID) {
      await adicionarNaPlanilha(dados);
      console.log('✅ Processamento completo!');
    }
  } catch (error) {
    console.error('❌ Erro:', error);
  }
});
  
  // Processa os dados DEPOIS de responder
  try {
    const dados = req.body;
    
    if (!dados.eventID) {
      console.log('⚠️ EventID não encontrado, mas webhook aceito');
      return;
    }
    
    await adicionarNaPlanilha(dados);
    console.log('✅ Processamento completo!');
    
  } catch (error) {
    console.error('❌ Erro ao processar webhook:', error);
  }
});

// Rota de teste
app.get('/', (req, res) => {
  res.json({ 
    status: 'online',
    message: 'Servidor WaSpeed → Google Sheets funcionando!',
    timestamp: new Date().toISOString()
  });
});

// Rota para testar conexão com a planilha
app.get('/test-sheets', async (req, res) => {
  try {
    const response = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });
    
    res.json({ 
      success: true,
      planilha: response.data.properties.title,
      message: 'Conexão com Google Sheets OK!'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Erro ao conectar com Google Sheets',
      error: error.message
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📊 Planilha ID: ${SPREADSHEET_ID}`);
});
