// server.js
const express = require('express');
const { google } = require('googleapis');
const app = express();

app.use(express.json());

// Configurações - você vai preencher via variáveis de ambiente no Render
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
  
  // Determina qual aba usar baseado no evento
  let aba = 'Eventos';
  let valores = [timestamp, dados.eventID, dados.name, dados.number];
  
  // Adiciona detalhes específicos por tipo de evento
  if (dados.eventDetails) {
    valores.push(JSON.stringify(dados.eventDetails));
  } else {
    valores.push('');
  }
  
  // Adiciona etiquetas se existirem
  if (dados.labels && dados.labels.length > 0) {
    valores.push(dados.labels.map(l => l.name).join(', '));
  } else {
    valores.push('');
  }
  
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${aba}!A:F`,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [valores],
      },
    });
    
    console.log(`✅ Dados salvos: ${dados.eventID} - ${dados.name}`);
    return true;
  } catch (error) {
    console.error('❌ Erro ao salvar na planilha:', error.message);
    throw error;
  }
}

// Rota principal do webhook
app.post('/webhook', async (req, res) => {
  try {
    const dados = req.body;
    
    console.log('📩 Webhook recebido:', JSON.stringify(dados, null, 2));
    
    // Valida se tem os dados básicos
    if (!dados.eventID) {
      return res.status(400).json({ 
        success: false, 
        message: 'EventID não encontrado' 
      });
    }
    
    // Adiciona na planilha
    await adicionarNaPlanilha(dados);
    
    res.status(200).json({ 
      success: true, 
      message: 'Dados recebidos e salvos com sucesso!',
      eventID: dados.eventID 
    });
    
  } catch (error) {
    console.error('❌ Erro ao processar webhook:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao processar webhook',
      error: error.message 
    });
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
