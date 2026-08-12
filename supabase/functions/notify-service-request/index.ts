// P360-012 — aviso ao cliente quando a solicitação muda de mão.
//
// Chamada pelo app logo depois de `admin_update_service_request`. Não decide nada: só conta ao
// cliente o que já foi decidido no banco. Por isso a primeira coisa que faz é conferir o estado
// da solicitação — sem isso, quem tivesse a chave anon poderia disparar um e-mail sobre algo
// que ninguém decidiu.
//
// Dois momentos, e só dois: quando a consultoria PERGUNTA (`awaiting_client`) e quando ENCERRA
// (`resolved`). Mudança de prioridade, atribuição e nota interna não viram e-mail — seriam
// ruído em quem não tem nada a fazer.
//
// Idempotência: a chave de dedupe do "aguardando cliente" é o carimbo de
// `awaiting_client_since`. Retry do app não reenvia; uma pergunta NOVA tem carimbo novo e
// notifica de novo.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';
import { safeMailSubject } from '../_shared/mailSubject.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Numero profissional fixo da consultora: a mensagem sempre vai para o celular dela, que
// encaminha ao cliente — nunca direto para o telefone do cliente.
const PROFESSIONAL_WHATSAPP_NUMBER = '5521993397315';

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
}

function asUuid(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text) ? text : null;
}

function esc(value: unknown): string {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function sendMail(params: { to: string; subject: string; plain: string; html: string }) {
  const user = Deno.env.get('SMTP_USER');
  const pass = Deno.env.get('SMTP_PASS');
  if (!user || !pass) throw new Error('SMTP nao configurado');
  const client = new SMTPClient({
    connection: {
      hostname: Deno.env.get('SMTP_HOST') || 'smtp.hostinger.com',
      port: Number(Deno.env.get('SMTP_PORT') || '465'),
      tls: true,
      auth: { username: user, password: pass },
    },
  });
  try {
    await client.send({ from: user, to: params.to, subject: safeMailSubject(params.subject), content: params.plain, html: params.html });
  } finally {
    await client.close();
  }
}

// Mesmo layout/cores do modelo de e-mail da marca usado em notify-evidence-reviewed.
function buildHtml(params: {
  heading: string;
  intro: string;
  requestLabel: string;
  note: string | null;
  noteHeading: string;
  ctaLabel: string;
  portalUrl: string;
}): string {
  const noteBlock = params.note
    ? `<div style="border:1px solid #DDE3F0;border-radius:8px;padding:16px;background:#F4F6FA;margin:0 0 26px;">
         <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#4E5975;font-weight:bold;padding-bottom:8px;">${esc(params.noteHeading)}</div>
         <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#16203C;">${esc(params.note)}</div>
       </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background-color:#EEF1F7;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#EEF1F7" style="background-color:#EEF1F7;padding:24px 10px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:#ffffff;border:1px solid #DDE3F0;border-radius:10px;">
  <tr>
    <td align="center" bgcolor="#0A1638" style="background-color:#0A1638;padding:34px 30px 28px;border-radius:9px 9px 0 0;">
      <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#ffffff;font-weight:bold;">Consultora Sanitária</div>
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:2px;color:#9DB4EE;padding-top:12px;">Consultoria Sanitária &amp; Treinamentos</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">
        <tr><td align="center" style="border-top:1px solid rgba(157,180,238,0.3);padding-top:18px;font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#9DB4EE;font-weight:bold;">Solicitações</td></tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:34px 34px 0;">
      <h1 style="margin:0 0 20px;font-family:Georgia,'Times New Roman',serif;font-size:27px;line-height:1.25;color:#0A1638;font-weight:bold;">${esc(params.heading)}</h1>
      <p style="margin:0 0 22px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.62;color:#16203C;">${params.intro}</p>
      <p style="margin:0 0 26px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.62;color:#16203C;"><strong>Solicitação:</strong> ${esc(params.requestLabel)}</p>
      ${noteBlock}
    </td>
  </tr>
  <tr>
    <td style="padding:0 34px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0A1638" style="background-color:#0A1638;border-radius:8px;">
        <tr><td style="padding:26px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td align="center" bgcolor="#4A6ED2" style="background-color:#4A6ED2;border-radius:6px;">
              <a href="${esc(params.portalUrl)}" target="_blank" style="display:block;padding:15px 18px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;letter-spacing:0.4px;">${esc(params.ctaLabel)}</a>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:30px 34px 34px;">
      <p style="margin:0 0 22px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.62;color:#16203C;">
        Qualquer dúvida, me chame no WhatsApp <strong>(21) 99339-7315</strong>. Estou por aqui.
      </p>
      <p style="margin:0 0 22px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.62;color:#16203C;">Atenciosamente,</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #DDE3F0;">
        <tr><td style="padding-top:20px;">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:20px;color:#0A1638;font-weight:bold;">Ester Caiafa</div>
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#4E5975;padding-top:5px;line-height:1.65;">
            Enfermeira Sanitarista · Consultora Sanitária<br>
            TreinaVISA Hub de Educação Sanitária<br>
            (21) 99339-7315 · <a href="https://www.consultorasanitaria.com.br" style="color:#4A6ED2;text-decoration:none;">consultorasanitaria.com.br</a>
          </div>
        </td></tr>
      </table>
    </td>
  </tr>
  <tr>
    <td bgcolor="#F4F6FA" style="background-color:#F4F6FA;border-top:1px solid #DDE3F0;padding:22px 34px;border-radius:0 0 9px 9px;">
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:11.5px;line-height:1.75;color:#4E5975;">
        <strong style="color:#0A1638;">HUB TREINAVISA SERVIÇOS LTDA</strong> · CNPJ 53.297.694/0001-37<br>
        Av. Embaixador Abelardo Bueno, 01, Edifício Lagoa 1, sala 153-D, Barra Olímpica, Rio de Janeiro<br>
        suporte@consultorasanitaria.com.br · (21) 99339-7315
      </div>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (!req.headers.get('authorization')) {
      return new Response('unauthorized', { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) {
      return jsonResponse({ error: 'Supabase service role nao configurado' }, { status: 500 });
    }

    const payload = await req.json().catch(() => ({}));
    const requestId = asUuid(payload.requestId);
    const portalUrl = String(payload.portalUrl ?? '').trim();
    if (!requestId) return jsonResponse({ error: 'requestId invalido' }, { status: 400 });
    if (!portalUrl) return jsonResponse({ error: 'portalUrl e obrigatorio' }, { status: 400 });

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: request, error: requestError } = await admin
      .from('client_service_requests')
      .select('id, request_number, subject, status, account_id, awaiting_client_since, closed_at')
      .eq('id', requestId)
      .maybeSingle();
    if (requestError) throw requestError;
    if (!request) return jsonResponse({ error: 'solicitacao nao encontrada' }, { status: 404 });

    // Só conta o que já foi decidido, e só os dois momentos que pedem algo do cliente.
    if (!['awaiting_client', 'resolved'].includes(request.status)) {
      return jsonResponse({ error: 'esta situacao nao gera aviso ao cliente' }, { status: 409 });
    }

    const awaiting = request.status === 'awaiting_client';
    const dedupeKey = String(awaiting ? request.awaiting_client_since : request.closed_at);

    // A orientação que o cliente precisa ler é o último evento visível — a mesma nota que a
    // consultora escreveu ao mudar o status.
    const { data: events, error: eventsError } = await admin
      .from('client_service_request_events')
      .select('note, to_status, created_at')
      .eq('request_id', requestId)
      .eq('visible_to_client', true)
      .not('note', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1);
    if (eventsError) throw eventsError;
    const note = events?.[0]?.note || null;

    const { data: account, error: accountError } = await admin
      .from('client_portal_accounts')
      .select('name, email')
      .eq('id', request.account_id)
      .maybeSingle();
    if (accountError) throw accountError;

    const { data: inserted, error: logError } = await admin
      .from('client_service_request_notifications')
      .upsert(
        { request_id: requestId, event_type: awaiting ? 'awaiting_client' : 'resolved', dedupe_key: dedupeKey },
        { onConflict: 'request_id,event_type,dedupe_key', ignoreDuplicates: true }
      )
      .select('request_id');
    if (logError) throw logError;
    const shouldSend = (inserted || []).length > 0;

    const requestLabel = `${request.request_number} — ${request.subject}`;
    const heading = awaiting
      ? 'Precisamos de uma informação sua.'
      : 'Sua solicitação foi concluída.';
    const intro = awaiting
      ? 'A consultoria analisou seu pedido e <strong>precisa de um retorno seu</strong> para continuar.'
      : 'A consultoria <strong>concluiu</strong> o atendimento do seu pedido.';
    const ctaLabel = awaiting ? 'Responder no portal' : 'Ver a solicitação';
    const noteHeading = awaiting ? 'O que precisamos' : 'Retorno da consultoria';

    const html = buildHtml({ heading, intro, requestLabel, note, noteHeading, ctaLabel, portalUrl });
    const plain = [
      heading,
      '',
      intro.replace(/<[^>]+>/g, ''),
      `Solicitação: ${requestLabel}`,
      note ? `${noteHeading}: ${note}` : '',
      '',
      portalUrl,
    ].filter(Boolean).join('\n');

    let emailSent = false;
    let emailError: string | undefined;
    if (shouldSend && account?.email) {
      try {
        await sendMail({
          to: account.email,
          subject: awaiting
            ? `Sua resposta é necessária — solicitação ${request.request_number}`
            : `Solicitação ${request.request_number} concluída`,
          plain,
          html,
        });
        emailSent = true;
        await admin
          .from('client_service_request_notifications')
          .update({ email_sent: true })
          .eq('request_id', requestId)
          .eq('event_type', awaiting ? 'awaiting_client' : 'resolved')
          .eq('dedupe_key', dedupeKey);
      } catch (err) {
        emailError = String(err);
      }
    }

    // WhatsApp continua manual: o link abre a conversa no numero profissional da consultora,
    // que encaminha ao cliente.
    const whatsappMessage = `${heading} ${account?.name || ''} — solicitação ${requestLabel}. ${portalUrl}`;
    const whatsappLink = `https://wa.me/${PROFESSIONAL_WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappMessage)}`;

    return jsonResponse({ ok: true, emailSent, emailError, alreadyNotified: !shouldSend, whatsappLink });
  } catch (err) {
    console.error('[notify-service-request] erro:', err);
    return jsonResponse({ error: String(err) }, { status: 500 });
  }
});
