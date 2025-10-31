// ... (código anterior) ...

const sheetsService = require('./sheetsService');

// Configurações do Google Sheets
const SPREADSHEET_ID = process.env.SPREADSHEET_ID; // ID da sua planilha
const SHEET_RANGE = 'Webhooks!A:K'; // Nome da aba e range

// Inicializar Sheets ao iniciar servidor
(async () => {
  await sheetsService.initialize();
  
  // Criar cabeçalho (descomente apenas na primeira vez)
  // await sheetsService.criarCabecalho(SPREADSHEET_ID, 'Webhooks!A1:K1');
  // await sheetsService.formatarPlanilha(SPREADSHEET_ID, 0);
})();

// ============================================
// ROTA PRINCIPAL DO WEBHOOK (COM SHEETS)
// ============================================

app.post('/webhook/waspeed', async (req, res) => {
  try {
    console.log('
🔔 Webhook recebido!');
    
    if (!req.body || Object.keys(req.body).length === 0) {
      console.log('⚠️ Body vazio recebido');
      return res.status(400).json({
        success: false,
        error: 'Body vazio'
      });
    }
    
    const {
      eventID,
      name,
      number,
      eventDetails,
      lastMessage,
      labels,
      unreadMessages,
      perfilContato,
      user
    } = req.body;
    
    // Salvar no MongoDB
    const webhookData = {
      eventID: eventID || 'unknown',
      name: name || 'N/A',
      number: number || 'N/A',
      eventDetails: eventDetails || {},
      lastMessage: lastMessage || null,
      labels: labels || [],
      unreadMessages: unreadMessages || 0,
      perfilContato: perfilContato || null,
      user: user || null,
      rawData: req.body,
      receivedAt: new Date()
    };
    
    const webhook = new Webhook(webhookData);
    await webhook.save();
    
    console.log(`✅ Webhook salvo no MongoDB! ID: ${webhook._id}`);
    
    // Enviar para Google Sheets
    try {
      if (SPREADSHEET_ID) {
        await sheetsService.adicionarLinha(
          SPREADSHEET_ID,
          SHEET_RANGE,
          req.body
        );
        console.log('📊 Dados enviados para Google Sheets!');
      }
    } catch (sheetsError) {
      console.error('⚠️ Erro ao enviar para Sheets (continuando):', sheetsError.message);
      // Não falhar o webhook por erro no Sheets
    }
    
    return res.status(200).json({
      success: true,
      message: 'Webhook processado com sucesso',
      id: webhook._id,
      eventID: eventID
    });
    
  } catch (error) {
    console.error('❌ Erro ao processar webhook:', error);
    
    return res.status(200).json({
      success: false,
      error: 'Erro ao processar webhook',
      message: error.message
    });
  }
});

// ... (resto do código) ...
