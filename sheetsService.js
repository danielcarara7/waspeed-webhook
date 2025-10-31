const { google } = require('googleapis');
const fs = require('fs');

class SheetsService {
  constructor() {
    this.sheets = null;
    this.auth = null;
  }

  // Inicializar autenticação
  async initialize() {
    try {
      // Carregar credenciais
      const credentials = JSON.parse(
        fs.readFileSync('credentials.json', 'utf8')
      );

      this.auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });

      this.sheets = google.sheets({ version: 'v4', auth: this.auth });
      console.log('✅ Google Sheets conectado!');
      
    } catch (error) {
      console.error('❌ Erro ao conectar Google Sheets:', error);
    }
  }

  // Formatar dados do webhook para a planilha
  formatarDadosWebhook(webhookData) {
    const {
      eventID,
      name,
      number,
      lastMessage,
      unreadMessages,
      labels,
      user,
      eventDetails
    } = webhookData;

    // Extrair informações da mensagem
    let mensagemTexto = '';
    let mensagemTipo = '';
    let mensagemTimestamp = '';

    if (lastMessage) {
      mensagemTexto = lastMessage.text || '';
      mensagemTipo = lastMessage.type || '';
      mensagemTimestamp = lastMessage.timestamp 
        ? new Date(lastMessage.timestamp * 1000).toLocaleString('pt-BR')
        : '';
    }

    // Extrair labels/etiquetas
    const etiquetas = labels && labels.length > 0
      ? labels.map(l => l.name).join(', ')
      : '';

    // Dados do evento (se houver)
    let eventoDetalhes = '';
    if (eventDetails) {
      eventoDetalhes = JSON.stringify(eventDetails);
    }

    // Formatar número (remover caracteres extras)
    const numeroFormatado = number 
      ? number.replace('@g.us', '').replace('@c.us', '')
      : '';

    // Data e hora atual
    const dataHora = new Date().toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo'
    });

    // Retornar array com dados organizados
    return [
      dataHora,                    // A: Data/Hora
      eventID || '',               // B: Tipo de Evento
      name || '',                  // C: Nome do Contato
      numeroFormatado,             // D: Número
      mensagemTexto,               // E: Mensagem
      mensagemTipo,                // F: Tipo de Mensagem
      mensagemTimestamp,           // G: Data da Mensagem
      unreadMessages || 0,         // H: Mensagens Não Lidas
      etiquetas,                   // I: Etiquetas
      user || '',                  // J: Usuário
      eventoDetalhes              // K: Detalhes do Evento
    ];
  }

  // Adicionar linha na planilha
  async adicionarLinha(spreadsheetId, range, dados) {
    try {
      const dadosFormatados = this.formatarDadosWebhook(dados);

      const request = {
        spreadsheetId,
        range,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: {
          values: [dadosFormatados]
        }
      };

      const response = await this.sheets.spreadsheets.values.append(request);
      
      console.log('✅ Dados adicionados na planilha:', response.data);
      return response.data;
      
    } catch (error) {
      console.error('❌ Erro ao adicionar na planilha:', error);
      throw error;
    }
  }

  // Criar cabeçalho na planilha (executar apenas uma vez)
  async criarCabecalho(spreadsheetId, range) {
    try {
      const cabecalho = [
        'Data/Hora',
        'Tipo de Evento',
        'Nome',
        'Número',
        'Mensagem',
        'Tipo Mensagem',
        'Data Mensagem',
        'Não Lidas',
        'Etiquetas',
        'Usuário',
        'Detalhes'
      ];

      const request = {
        spreadsheetId,
        range,
        valueInputOption: 'RAW',
        resource: {
          values: [cabecalho]
        }
      };

      await this.sheets.spreadsheets.values.update(request);
      console.log('✅ Cabeçalho criado!');
      
    } catch (error) {
      console.error('❌ Erro ao criar cabeçalho:', error);
    }
  }

  // Formatar células (cores, negrito, etc)
  async formatarPlanilha(spreadsheetId, sheetId = 0) {
    try {
      const requests = [
        {
          // Formatar cabeçalho
          repeatCell: {
            range: {
              sheetId: sheetId,
              startRowIndex: 0,
              endRowIndex: 1
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.4, green: 0.5, blue: 0.9 },
                textFormat: {
                  foregroundColor: { red: 1, green: 1, blue: 1 },
                  fontSize: 11,
                  bold: true
                },
                horizontalAlignment: 'CENTER'
              }
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
          }
        },
        {
          // Auto-resize colunas
          autoResizeDimensions: {
            dimensions: {
              sheetId: sheetId,
              dimension: 'COLUMNS',
              startIndex: 0,
              endIndex: 11
            }
          }
        },
        {
          // Congelar primeira linha
          updateSheetProperties: {
            properties: {
              sheetId: sheetId,
              gridProperties: {
                frozenRowCount: 1
              }
            },
            fields: 'gridProperties.frozenRowCount'
          }
        }
      ];

      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: { requests }
      });

      console.log('✅ Planilha formatada!');
      
    } catch (error) {
      console.error('❌ Erro ao formatar planilha:', error);
    }
  }
}

module.exports = new SheetsService();
