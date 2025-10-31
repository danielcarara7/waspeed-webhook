const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// ============================================
// CONFIGURAÇÕES DE SEGURANÇA E MIDDLEWARE
// ============================================

// Helmet para segurança
app.use(helmet());

// CORS - permitir requisições do frontend
app.use(cors({
  origin: '*', // Em produção, especifique o domínio
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parser com limite maior para webhooks grandes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting para proteção contra DDoS
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100 // limite de 100 requisições por IP
});
app.use('/api/', limiter);

// Servir arquivos estáticos
app.use(express.static('public'));

// ============================================
// CONEXÃO COM MONGODB
// ============================================

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB conectado com sucesso!'))
.catch(err => {
  console.error('❌ Erro ao conectar MongoDB:', err);
  process.exit(1);
});

// ============================================
// SCHEMAS DO BANCO DE DADOS
// ============================================

// Schema principal para webhooks
const webhookSchema = new mongoose.Schema({
  // Dados básicos
  eventID: {
    type: String,
    required: true,
    index: true
  },
  name: String,
  number: {
    type: String,
    index: true
  },
  
  // Dados do evento
  eventDetails: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Informações da mensagem (se houver)
  lastMessage: {
    text: String,
    timestamp: Number,
    type: String
  },
  
  // Labels/Etiquetas
  labels: [{
    id: String,
    name: String,
    color: Number,
    hexColor: String
  }],
  
  // Metadados
  unreadMessages: Number,
  perfilContato: String,
  user: String,
  
  // Dados completos (backup)
  rawData: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  
  // Timestamps automáticos
  receivedAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Índices compostos para queries rápidas
webhookSchema.index({ eventID: 1, receivedAt: -1 });
webhookSchema.index({ number: 1, receivedAt: -1 });
webhookSchema.index({ user: 1, receivedAt: -1 });

const Webhook = mongoose.model('Webhook', webhookSchema);

// ============================================
// MIDDLEWARE DE LOGGING
// ============================================

app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// ============================================
// ROTA PRINCIPAL DO WEBHOOK (CRUCIAL!)
// ============================================

app.post('/webhook/waspeed', async (req, res) => {
  try {
    console.log('
🔔 Webhook recebido!');
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Body:', JSON.stringify(req.body, null, 2));
    
    // Validação básica
    if (!req.body || Object.keys(req.body).length === 0) {
      console.log('⚠️ Body vazio recebido');
      return res.status(400).json({
        success: false,
        error: 'Body vazio'
      });
    }
    
    // Extrair dados do webhook
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
    
    // Criar objeto para salvar
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
    
    // Salvar no banco
    const webhook = new Webhook(webhookData);
    await webhook.save();
    
    console.log(`✅ Webhook salvo com sucesso! ID: ${webhook._id}`);
    console.log(`📊 EventID: ${eventID}`);
    console.log(`👤 Contato: ${name} (${number})`);
    
    // Resposta de sucesso (IMPORTANTE!)
    return res.status(200).json({
      success: true,
      message: 'Webhook recebido e processado com sucesso',
      id: webhook._id,
      eventID: eventID
    });
    
  } catch (error) {
    console.error('❌ Erro ao processar webhook:', error);
    console.error('Stack:', error.stack);
    
    // Retornar 200 mesmo com erro para não causar reenvios
    return res.status(200).json({
      success: false,
      error: 'Erro ao processar webhook',
      message: error.message
    });
  }
});

// ============================================
// ROTA DE TESTE (IMPORTANTE PARA DEBUG)
// ============================================

app.get('/webhook/test', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Servidor de webhooks funcionando!',
    timestamp: new Date().toISOString()
  });
});

app.post('/webhook/test', (req, res) => {
  console.log('📨 Teste POST recebido:', req.body);
  res.json({
    success: true,
    received: req.body
  });
});

// ============================================
// ROTAS DA API PARA O DASHBOARD
// ============================================

// Listar webhooks com filtros
app.get('/api/webhooks', async (req, res) => {
  try {
    const {
      limit = 50,
      page = 1,
      eventID,
      number,
      dataInicio,
      dataFim,
      user
    } = req.query;
    
    // Construir query
    const query = {};
    
    if (eventID) query.eventID = eventID;
    if (number) query.number = number;
    if (user) query.user = user;
    
    if (dataInicio || dataFim) {
      query.receivedAt = {};
      if (dataInicio) query.receivedAt.$gte = new Date(dataInicio);
      if (dataFim) query.receivedAt.$lte = new Date(dataFim);
    }
    
    // Executar query com paginação
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const webhooks = await Webhook
      .find(query)
      .sort({ receivedAt: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .lean();
    
    const total = await Webhook.countDocuments(query);
    
    res.json({
      success: true,
      data: webhooks,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
    
  } catch (error) {
    console.error('Erro ao buscar webhooks:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Buscar webhook por ID
app.get('/api/webhooks/:id', async (req, res) => {
  try {
    const webhook = await Webhook.findById(req.params.id);
    
    if (!webhook) {
      return res.status(404).json({
        success: false,
        error: 'Webhook não encontrado'
      });
    }
    
    res.json({
      success: true,
      data: webhook
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Estatísticas
app.get('/api/estatisticas', async (req, res) => {
  try {
    const { dataInicio, dataFim } = req.query;
    
    // Query base
    const matchQuery = {};
    if (dataInicio || dataFim) {
      matchQuery.receivedAt = {};
      if (dataInicio) matchQuery.receivedAt.$gte = new Date(dataInicio);
      if (dataFim) matchQuery.receivedAt.$lte = new Date(dataFim);
    }
    
    // Total de webhooks
    const total = await Webhook.countDocuments(matchQuery);
    
    // Por tipo de evento
    const porEvento = await Webhook.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$eventID',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    // Últimos 7 dias
    const seteDiasAtras = new Date();
    seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
    
    const ultimos7Dias = await Webhook.aggregate([
      {
        $match: {
          receivedAt: { $gte: seteDiasAtras }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$receivedAt',
              timezone: 'America/Sao_Paulo'
            }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    // Últimas 24 horas
    const umDiaAtras = new Date();
    umDiaAtras.setHours(umDiaAtras.getHours() - 24);
    
    const ultimas24h = await Webhook.countDocuments({
      receivedAt: { $gte: umDiaAtras }
    });
    
    // Top contatos
    const topContatos = await Webhook.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            number: '$number',
            name: '$name'
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    
    res.json({
      success: true,
      data: {
        total,
        ultimas24h,
        porEvento,
        ultimos7Dias,
        topContatos
      }
    });
    
  } catch (error) {
    console.error('Erro ao gerar estatísticas:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Deletar webhook
app.delete('/api/webhooks/:id', async (req, res) => {
  try {
    const webhook = await Webhook.findByIdAndDelete(req.params.id);
    
    if (!webhook) {
      return res.status(404).json({
        success: false,
        error: 'Webhook não encontrado'
      });
    }
    
    res.json({
      success: true,
      message: 'Webhook deletado com sucesso'
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Limpar todos os webhooks (cuidado!)
app.delete('/api/webhooks', async (req, res) => {
  try {
    const result = await Webhook.deleteMany({});
    
    res.json({
      success: true,
      message: `${result.deletedCount} webhooks deletados`
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// ROTA 404
// ============================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Rota não encontrada',
    path: req.path
  });
});

// ============================================
// INICIAR SERVIDOR
// ============================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log('
🚀 ================================');
  console.log(`✅ Servidor rodando na porta ${PORT}`);
  console.log(`🔗 URL Local: http://localhost:${PORT}`);
  console.log(`📡 Webhook URL: http://localhost:${PORT}/webhook/waspeed`);
  console.log(`🧪 Teste: http://localhost:${PORT}/webhook/test`);
  console.log('🔥 ================================
');
});

// Tratamento de erros não capturados
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});
