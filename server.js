const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

app.get('/', (req, res) => {
  res.json({ status: 'Webhook receiver ativo', timestamp: new Date().toISOString() });
});

app.post('/webhook/crm', async (req, res) => {
  try {
    const payload = req.body;

    const { error } = await supabase.from('webhook_crm').insert({
      data_hora: payload.lastMessage?.timestamp ? new Date(payload.lastMessage.timestamp * 1000).toISOString() : null,
      usuario: payload.user,
      cliente: payload.name,
      numero_usuario: payload.number,
      nivel_cliente: payload.eventDetails?.name,
      tipo: payload.lastMessage?.type,
      ultima_mensagem: payload.lastMessage?.text,
      tipo_evento: payload.eventID,
      tipo_usuario: payload.eventDetails?.type,
      perfil_contato: payload.perfilContato,
      info: payload.unreadMessages,
      labels: payload.labels,
      evento_id: payload.eventDetails?.id,
      evento_nome: payload.eventDetails?.name,
      evento_tipo: payload.eventDetails?.type,
      raw_payload: payload
    });

    if (error) throw error;

    res.status(200).json({ success: true, message: 'CRM webhook recebido' });
  } catch (error) {
    console.error('Erro webhook CRM:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/webhook/mensagens', async (req, res) => {
  try {
    const payload = req.body;
    const ed = payload.eventDetails || {};
    const eid = ed.id || {};

    const { error } = await supabase.from('mensagens').insert({
      nome_contato: payload.name,
      numero_contato: payload.number,
      usuario: payload.user,
      unread_messages: payload.unreadMessages,
      labels: payload.labels,
      last_msg_text: payload.lastMessage?.text,
      last_msg_tipo: payload.lastMessage?.type,
      last_msg_timestamp: payload.lastMessage?.timestamp ? new Date(payload.lastMessage.timestamp * 1000).toISOString() : null,
      event_id: payload.eventID,
      msg_from_me: eid.fromMe,
      msg_remote: eid.remote,
      msg_id: eid.id,
      msg_serialized: eid._serialized,
      msg_body: ed.body,
      msg_type: ed.type,
      msg_subtype: ed.subtype,
      msg_timestamp: ed.t ? new Date(ed.t * 1000).toISOString() : null,
      msg_from_jid: ed.from,
      msg_to_jid: ed.to,
      msg_ack: ed.ack,
      msg_is_new: ed.isNewMsg,
      msg_viewed: ed.viewed,
      msg_star: ed.star,
      msg_kic_notified: ed.kicNotified,
      msg_is_from_template: ed.isFromTemplate,
      msg_is_ads_media: ed.isAdsMedia,
      msg_poll_invalidated: ed.pollInvalidated,
      msg_is_forwarded: ed.isForwarded,
      msg_is_question: ed.isQuestion,
      msg_has_reaction: ed.hasReaction,
      msg_is_event_canceled: ed.isEventCanceled,
      msg_event_invalidated: ed.eventInvalidated,
      msg_is_avatar: ed.isAvatar,
      msg_question_responses_count: ed.questionResponsesCount,
      msg_read_question_responses_count: ed.readQuestionResponsesCount,
      msg_labels: ed.labels,
      msg_mentioned_jid_list: ed.mentionedJidList,
      msg_group_mentions: ed.groupMentions,
      msg_disappearing_initiator: ed.disappearingModeInitiator,
      msg_disappearing_trigger: ed.disappearingModeTrigger,
      msg_view_mode: ed.viewMode,
      message_secret: ed.messageSecret,
      limit_sharing: ed.limitSharing,
      perfil_contato: payload.perfilContato,
      raw_payload: payload
    });

    if (error) throw error;

    res.status(200).json({ success: true, message: 'Mensagem webhook recebido' });
  } catch (error) {
    console.error('Erro webhook mensagens:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
