// P360-011 — aviso ao cliente depois que a consultora revisa a evidência.
//
// Chamada pelo app logo após `admin_review_client_action_evidence`. Não decide nada: só conta
// ao cliente o que já foi decidido no banco. Por isso a primeira coisa que faz é conferir que
// a evidência está mesmo revisada — sem isso, quem tivesse a chave anon poderia disparar um
// e-mail sobre algo que nunca foi julgado.
//
// Idempotência: a chave de dedupe é o carimbo de `reviewed_at`. Retry do app não reenvia; uma
// revisão NOVA (devolver depois de aprovar) tem carimbo novo e notifica de novo.

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

// Mesmo layout/cores do modelo de e-mail da marca usado em notify-appointment-event.
function buildHtml(params: {
  heading: string;
  intro: string;
  itemTitle: string;
  reviewNote: string | null;
  ctaLabel: string;
  portalUrl: string;
}): string {
  const noteBlock = params.reviewNote
    ? `<div style="border:1px solid #DDE3F0;border-radius:8px;padding:16px;background:#F4F6FA;margin:0 0 26px;">
         <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#4E5975;font-weight:bold;padding-bottom:8px;">Orientação da consultoria</div>
         <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#16203C;">${esc(params.reviewNote)}</div>
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
        <tr><td align="center" style="border-top:1px solid rgba(157,180,238,0.3);padding-top:18px;font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#9DB4EE;font-weight:bold;">Plano de ação</td></tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:34px 34px 0;">
      <h1 style="margin:0 0 20px;font-family:Georgia,'Times New Roman',serif;font-size:27px;line-height:1.25;color:#0A1638;font-weight:bold;">${esc(params.heading)}</h1>
      <p style="margin:0 0 22px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.62;color:#16203C;">${params.intro}</p>
      <p style="margin:0 0 26px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.62;color:#16203C;"><strong>Pendência:</strong> ${esc(params.itemTitle)}</p>
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
    const evidenceId = asUuid(payload.evidenceId);
    const portalUrl = String(payload.portalUrl ?? '').trim();
    if (!evidenceId) return jsonResponse({ error: 'evidenceId invalido' }, { status: 400 });
    if (!portalUrl) return jsonResponse({ error: 'portalUrl e obrigatorio' }, { status: 400 });

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: evidence, error: evidenceError } = await admin
      .from('client_action_evidence')
      .select('id, account_id, action_item_id, status, review_note, reviewed_at, file_name')
      .eq('id', evidenceId)
      .maybeSingle();
    if (evidenceError) throw evidenceError;
    if (!evidence) return jsonResponse({ error: 'evidencia nao encontrada' }, { status: 404 });

    // Só conta o que já foi decidido.
    if (!evidence.reviewed_at || !['approved', 'changes_requested'].includes(evidence.status)) {
      return jsonResponse({ error: 'evidencia ainda nao foi revisada' }, { status: 409 });
    }

    const { data: item, error: itemError } = await admin
      .from('client_action_items')
      .select('title')
      .eq('id', evidence.action_item_id)
      .maybeSingle();
    if (itemError) throw itemError;

    const { data: account, error: accountError } = await admin
      .from('client_portal_accounts')
      .select('name, email')
      .eq('id', evidence.account_id)
      .maybeSingle();
    if (accountError) throw accountError;

    const { data: inserted, error: logError } = await admin
      .from('client_action_evidence_notifications')
      .upsert(
        { evidence_id: evidenceId, event_type: 'reviewed', dedupe_key: String(evidence.reviewed_at) },
        { onConflict: 'evidence_id,event_type,dedupe_key', ignoreDuplicates: true }
      )
      .select('evidence_id');
    if (logError) throw logError;
    const shouldSend = (inserted || []).length > 0;

    const approved = evidence.status === 'approved';
    const itemTitle = item?.title || 'pendência do plano de ação';
    const heading = approved ? 'Sua evidência foi aprovada.' : 'Sua evidência precisa de ajuste.';
    const intro = approved
      ? 'A consultoria analisou o arquivo que você enviou e ele foi <strong>aceito</strong>.'
      : 'A consultoria analisou o arquivo que você enviou e pediu um <strong>ajuste</strong> antes de aceitar.';
    const ctaLabel = approved ? 'Ver o plano de ação' : 'Reenviar a evidência';

    const html = buildHtml({
      heading,
      intro,
      itemTitle,
      reviewNote: evidence.review_note || null,
      ctaLabel,
      portalUrl,
    });
    const plain = [
      heading,
      '',
      intro.replace(/<[^>]+>/g, ''),
      `Pendência: ${itemTitle}`,
      evidence.review_note ? `Orientação da consultoria: ${evidence.review_note}` : '',
      '',
      portalUrl,
    ].filter(Boolean).join('\n');

    let emailSent = false;
    let emailError: string | undefined;
    if (shouldSend && account?.email) {
      try {
        await sendMail({
          to: account.email,
          subject: approved
            ? `Evidência aprovada — ${itemTitle}`
            : `Evidência devolvida para ajuste — ${itemTitle}`,
          plain,
          html,
        });
        emailSent = true;
        await admin
          .from('client_action_evidence_notifications')
          .update({ email_sent: true })
          .eq('evidence_id', evidenceId)
          .eq('event_type', 'reviewed')
          .eq('dedupe_key', String(evidence.reviewed_at));
      } catch (err) {
        emailError = String(err);
      }
    }

    // WhatsApp continua manual: o link abre a conversa no numero profissional da consultora,
    // que encaminha ao cliente.
    const whatsappMessage = `${heading} ${account?.name || ''} — ${itemTitle}. ${portalUrl}`;
    const whatsappLink = `https://wa.me/${PROFESSIONAL_WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappMessage)}`;

    return jsonResponse({ ok: true, emailSent, emailError, alreadyNotified: !shouldSend, whatsappLink });
  } catch (err) {
    console.error('[notify-evidence-reviewed] erro:', err);
    return jsonResponse({ error: String(err) }, { status: 500 });
  }
});
