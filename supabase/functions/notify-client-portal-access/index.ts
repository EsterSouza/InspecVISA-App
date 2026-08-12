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
    const accountName = String(payload.accountName ?? 'Portal do Cliente').trim();
    const code = String(payload.code ?? '').trim();
    const portalUrl = String(payload.portalUrl ?? 'https://inspecvisa.consultorasanitaria.com.br/cliente').trim();
    const unitCount = Number(payload.unitCount ?? 0);

    if (!email || !code || !portalUrl) {
      return jsonResponse({ error: 'email, code e portalUrl sao obrigatorios' }, { status: 400 });
    }

    const plain = [
      'Acesso ao Portal do Cliente InspecVISA',
      '',
      `Acesso: ${accountName}`,
      `Link: ${portalUrl}`,
      `E-mail: ${email}`,
      `Senha: ${code}`,
      unitCount > 0 ? `Unidades vinculadas: ${unitCount}` : '',
      '',
      'Use este portal para acompanhar agendamentos, status da inspeção, relatorios, fotos e anexos.',
    ].filter(Boolean).join('\n');

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1f2937">
        <h2 style="color:#101D45;margin:0 0 10px">Acesso ao Portal do Cliente</h2>
        <p style="color:#4b5563;margin:0 0 18px">
          Use os dados abaixo para acompanhar suas unidades, agendamentos, status da inspecao,
          relatorios, fotos e anexos.
        </p>
        <div style="border:1px solid #dbe3f0;border-radius:8px;padding:16px;background:#f8fafc">
          <p style="margin:0 0 6px;color:#6b7280;font-size:12px;text-transform:uppercase">Acesso</p>
          <p style="margin:0 0 16px;font-weight:bold">${esc(accountName)}</p>
          <p style="margin:0 0 6px;color:#6b7280;font-size:12px;text-transform:uppercase">E-mail</p>
          <p style="margin:0 0 16px">${esc(email)}</p>
          <p style="margin:0 0 6px;color:#6b7280;font-size:12px;text-transform:uppercase">Senha</p>
          <p style="margin:0;font-family:Consolas,monospace;font-size:24px;font-weight:bold;letter-spacing:3px;color:#101D45">${esc(code)}</p>
        </div>
        ${unitCount > 0 ? `<p style="color:#4b5563;margin:14px 0 0">Unidades vinculadas: <strong>${unitCount}</strong></p>` : ''}
        <p style="margin:22px 0 0">
          <a href="${esc(portalUrl)}"
             style="display:inline-block;background:#1d3a8a;color:#fff;text-decoration:none;padding:12px 18px;border-radius:6px;font-weight:bold">
            Acessar Portal do Cliente
          </a>
        </p>
      </div>`;

    await sendMail({
      to: email,
      subject: `Acesso ao Portal do Cliente - ${accountName}`,
      plain,
      html,
    });

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error('[notify-client-portal-access] erro:', err);
    return jsonResponse({ error: String(err) }, { status: 500 });
  }
});
