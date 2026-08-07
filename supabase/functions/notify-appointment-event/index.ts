import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Numero profissional fixo da consultora: o WhatsApp conectado no PC e o pessoal, entao a
// mensagem sempre vai para o profissional (celular) e a consultora encaminha manualmente ao
// cliente — nunca envia direto para o telefone do cliente.
const PROFESSIONAL_WHATSAPP_NUMBER = '5521993397315';

const EVENT_TYPES = ['confirmed', 'rescheduled', 'cancelled'] as const;
type EventType = typeof EVENT_TYPES[number];

const TYPE_LABELS: Record<string, string> = {
  inspection: 'Inspeção',
  follow_up_meeting: 'Reunião de acompanhamento',
  results_meeting: 'Reunião de resultados',
  document_guidance: 'Orientação documental',
  training: 'Treinamento',
  briefing: 'Briefing',
  audit: 'Auditoria',
  online_followup: 'Acompanhamento online',
  other: 'Compromisso',
};

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatDateTimeBR(date: string | null, time: string | null): string {
  if (!date) return 'a confirmar';
  const [y, m, d] = date.split('T')[0].split('-');
  const dateLabel = y && m && d ? `${d}/${m}/${y}` : date;
  return time ? `${dateLabel} às ${time}` : dateLabel;
}

function whatsappUrl(message: string): string {
  return `https://wa.me/${PROFESSIONAL_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

async function sendMail(params: { to: string; subject: string; plain: string; html: string }) {
  const user = Deno.env.get('SMTP_USER');
  const pass = Deno.env.get('SMTP_PASS');
  if (!user || !pass) {
    throw new Error('SMTP nao configurado');
  }
  const client = new SMTPClient({
    connection: {
      hostname: Deno.env.get('SMTP_HOST') || 'smtp.hostinger.com',
      port: Number(Deno.env.get('SMTP_PORT') || '465'),
      tls: true,
      auth: { username: user, password: pass },
    },
  });
  try {
    await client.send({ from: user, to: params.to, subject: params.subject, content: params.plain, html: params.html });
  } finally {
    await client.close();
  }
}

interface EventContent {
  subject: string;
  heading: string;
  intro: string;
  ctaLabel: string;
}

function buildEventContent(eventType: EventType, unitName: string, typeLabel: string, whenLabel: string): EventContent {
  switch (eventType) {
    case 'confirmed':
      return {
        subject: `Compromisso confirmado — ${unitName}`,
        heading: 'Seu compromisso foi confirmado.',
        intro: `O compromisso de <strong>${esc(typeLabel)}</strong> da <strong>${esc(unitName)}</strong> está confirmado para <strong>${esc(whenLabel)}</strong>.`,
        ctaLabel: 'Ver detalhes e adicionar ao calendário',
      };
    case 'rescheduled':
      return {
        subject: `Compromisso remarcado — ${unitName}`,
        heading: 'Seu compromisso foi remarcado.',
        intro: `O compromisso de <strong>${esc(typeLabel)}</strong> da <strong>${esc(unitName)}</strong> tem nova data: <strong>${esc(whenLabel)}</strong>.`,
        ctaLabel: 'Ver nova data no portal',
      };
    case 'cancelled':
      return {
        subject: `Compromisso cancelado — ${unitName}`,
        heading: 'Seu compromisso foi cancelado.',
        intro: `O compromisso de <strong>${esc(typeLabel)}</strong> da <strong>${esc(unitName)}</strong> (${esc(whenLabel)}) foi cancelado.`,
        ctaLabel: 'Fazer nova solicitação',
      };
  }
}

// Mesmo layout/cores do modelo de e-mail da marca (cabecalho/rodape/assinatura identicos;
// so o bloco central muda por evento).
function buildHtml(content: EventContent, portalUrl: string): string {
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
        <tr><td align="center" style="border-top:1px solid rgba(157,180,238,0.3);padding-top:18px;font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#9DB4EE;font-weight:bold;">Compromisso agendado</td></tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:34px 34px 0;">
      <h1 style="margin:0 0 20px;font-family:Georgia,'Times New Roman',serif;font-size:27px;line-height:1.25;color:#0A1638;font-weight:bold;">${esc(content.heading)}</h1>
      <p style="margin:0 0 26px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.62;color:#16203C;">${content.intro}</p>
    </td>
  </tr>
  <tr>
    <td style="padding:0 34px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0A1638" style="background-color:#0A1638;border-radius:8px;">
        <tr><td style="padding:26px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td align="center" bgcolor="#4A6ED2" style="background-color:#4A6ED2;border-radius:6px;">
              <a href="${esc(portalUrl)}" target="_blank" style="display:block;padding:15px 18px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;letter-spacing:0.4px;">${esc(content.ctaLabel)}</a>
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
    const appointmentRequestId = String(payload.appointmentRequestId ?? '').trim();
    const tenantId = String(payload.tenantId ?? '').trim();
    const eventType = String(payload.eventType ?? '') as EventType;
    const portalUrl = String(payload.portalUrl ?? '').trim();

    if (!appointmentRequestId || !tenantId) {
      return jsonResponse({ error: 'appointmentRequestId e tenantId sao obrigatorios' }, { status: 400 });
    }
    if (!EVENT_TYPES.includes(eventType)) {
      return jsonResponse({ error: 'eventType invalido' }, { status: 400 });
    }
    if (!portalUrl) {
      return jsonResponse({ error: 'portalUrl e obrigatorio' }, { status: 400 });
    }

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    const { data: request, error: requestError } = await admin
      .from('appointment_requests')
      .select('id, tenant_id, unit_name, appointment_type, email, responsible_name, requested_date, requested_time, updated_at')
      .eq('id', appointmentRequestId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (requestError) throw requestError;
    if (!request) return jsonResponse({ error: 'compromisso nao encontrado' }, { status: 404 });

    // Chave de dedupe por evento: confirmed/rescheduled usam o horario alvo (um novo horario e
    // uma notificacao logicamente nova); cancelled e fixa (so um e-mail de cancelamento).
    const dedupeKey = eventType === 'cancelled'
      ? 'cancelled'
      : `${request.requested_date ?? ''}T${request.requested_time ?? ''}`;

    const { data: insertedRows, error: insertError } = await admin
      .from('appointment_notification_log')
      .upsert(
        { tenant_id: tenantId, appointment_request_id: appointmentRequestId, event_type: eventType, dedupe_key: dedupeKey },
        { onConflict: 'appointment_request_id,event_type,dedupe_key', ignoreDuplicates: true }
      )
      .select('id');
    if (insertError) throw insertError;
    const shouldSend = (insertedRows || []).length > 0;

    const typeLabel = TYPE_LABELS[request.appointment_type] || 'Compromisso';
    const whenLabel = formatDateTimeBR(request.requested_date, request.requested_time);
    const content = buildEventContent(eventType, request.unit_name, typeLabel, whenLabel);
    const html = buildHtml(content, portalUrl);
    const plain = `${content.heading}\n\n${content.intro.replace(/<[^>]+>/g, '')}\n\n${portalUrl}`;

    let emailSent = false;
    let emailError: string | undefined;
    if (shouldSend && request.email) {
      try {
        await sendMail({ to: request.email, subject: content.subject, plain, html });
        emailSent = true;
        await admin.from('appointment_notification_log')
          .update({ email_sent: true })
          .eq('appointment_request_id', appointmentRequestId)
          .eq('event_type', eventType)
          .eq('dedupe_key', dedupeKey);
      } catch (err) {
        emailError = String(err);
      }
    }

    // WhatsApp continua manual: o link sempre aponta para o numero profissional da consultora,
    // nunca para o telefone do cliente — ela encaminha do celular pra cliente.
    const whatsappMessage = `${content.heading} ${request.unit_name} — ${typeLabel} em ${whenLabel}. ${portalUrl}`;
    const whatsappLink = whatsappUrl(whatsappMessage);

    return jsonResponse({
      ok: true,
      emailSent,
      emailError,
      whatsappSent: false,
      whatsappLink,
    });
  } catch (err) {
    console.error('[notify-appointment-event] erro:', err);
    return jsonResponse({ error: String(err) }, { status: 500 });
  }
});
