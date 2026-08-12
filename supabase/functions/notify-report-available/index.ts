import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';
import { safeMailSubject } from '../_shared/mailSubject.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

function onlyDigits(value: unknown): string {
  return String(value ?? '').replace(/\D/g, '');
}

function whatsappUrl(phone: string, message: string): string | null {
  const digits = onlyDigits(phone);
  if (!digits) return null;
  const withCountry = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`;
}

async function sendMail(params: {
  to: string;
  subject: string;
  plain: string;
  html: string;
}) {
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
    await client.send({
      from: user,
      to: params.to,
      subject: safeMailSubject(params.subject),
      content: params.plain,
      html: params.html,
    });
  } finally {
    await client.close();
  }
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (!req.headers.get('authorization')) {
      return new Response('unauthorized', { status: 401, headers: corsHeaders });
    }

    const payload = await req.json().catch(() => ({}));
    const email = String(payload.email ?? '').trim().toLowerCase();
    const phone = String(payload.phone ?? '').trim();
    const unitName = String(payload.unitName ?? 'sua unidade').trim();
    const portalUrl = String(payload.portalUrl ?? '').trim();
    const reportName = String(payload.reportName ?? 'relatorio.pdf').trim();

    if (!portalUrl) {
      return jsonResponse({ error: 'portalUrl e obrigatorio' }, { status: 400 });
    }

    const message = `O relatorio da inspecao sanitaria de ${unitName} ja esta disponivel no Portal do Cliente: ${portalUrl}`;
    const plain = [
      'Relatorio disponivel no Portal do Cliente InspecVISA',
      '',
      `Unidade: ${unitName}`,
      `Arquivo: ${reportName}`,
      `Link: ${portalUrl}`,
      '',
      'Acesse o portal para baixar o PDF e consultar fotos/anexos publicados.',
    ].join('\n');

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1f2937">
        <h2 style="color:#101D45;margin:0 0 10px">Relatorio disponivel</h2>
        <p style="color:#4b5563;margin:0 0 18px">
          O relatorio da inspecao sanitaria de <strong>${esc(unitName)}</strong> ja esta disponivel.
        </p>
        <div style="border:1px solid #dbe3f0;border-radius:8px;padding:16px;background:#f8fafc">
          <p style="margin:0 0 6px;color:#6b7280;font-size:12px;text-transform:uppercase">Arquivo</p>
          <p style="margin:0;font-weight:bold">${esc(reportName)}</p>
        </div>
        <p style="margin:22px 0 0">
          <a href="${esc(portalUrl)}"
             style="display:inline-block;background:#1d3a8a;color:#fff;text-decoration:none;padding:12px 18px;border-radius:6px;font-weight:bold">
            Acessar e baixar relatorio
          </a>
        </p>
      </div>`;

    let emailSent = false;
    let emailError: string | undefined;
    if (email) {
      try {
        await sendMail({
          to: email,
          subject: `Relatorio disponivel - ${unitName}`,
          plain,
          html,
        });
        emailSent = true;
      } catch (err) {
        emailError = String(err);
      }
    }

    const whatsappSent = false;
    let whatsappError: string | undefined;
    const whatsappLink = whatsappUrl(phone, message);
    if (phone && whatsappLink) {
      whatsappError = 'Link compartilhavel gerado; envio automatico por WhatsApp nao configurado.';
    }

    return jsonResponse({
      ok: true,
      emailSent,
      emailError,
      whatsappSent,
      whatsappError,
      whatsappLink,
    });
  } catch (err) {
    console.error('[notify-report-available] erro:', err);
    return jsonResponse({ error: String(err) }, { status: 500 });
  }
});
