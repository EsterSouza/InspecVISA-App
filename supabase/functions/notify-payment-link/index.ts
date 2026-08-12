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

function formatDateBR(value: string | null): string {
  if (!value) return '';
  const [year, month, day] = value.split('T')[0].split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
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
    const paymentLink = String(payload.paymentLink ?? '').trim();
    const paymentType = payload.paymentType === 'monthly' ? 'Mensal' : 'Avulso';
    const dueDate = formatDateBR(payload.dueDate ? String(payload.dueDate) : null);

    if (!email || !paymentLink) {
      return jsonResponse({ error: 'email e paymentLink sao obrigatorios' }, { status: 400 });
    }

    const dueLine = dueDate ? `Vencimento: ${dueDate}` : '';
    const plain = [
      'Link de pagamento - InspecVISA',
      '',
      `Cliente: ${accountName}`,
      `Tipo: ${paymentType}`,
      dueLine,
      '',
      `Link: ${paymentLink}`,
      '',
      'Formas disponiveis no link: Pix, boleto, NuPay, cartao de credito e cartao de debito.',
    ].filter(Boolean).join('\n');

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1f2937">
        <h2 style="color:#101D45;margin:0 0 10px">Link de pagamento InspecVISA</h2>
        <p style="color:#4b5563;margin:0 0 18px">
          Segue o link para pagamento do seu acesso ao Portal do Cliente.
        </p>
        <div style="border:1px solid #dbe3f0;border-radius:8px;padding:16px;background:#f8fafc">
          <p style="margin:0 0 6px;color:#6b7280;font-size:12px;text-transform:uppercase">Cliente</p>
          <p style="margin:0 0 14px;font-weight:bold">${esc(accountName)}</p>
          <p style="margin:0 0 6px;color:#6b7280;font-size:12px;text-transform:uppercase">Tipo</p>
          <p style="margin:0 0 14px">${esc(paymentType)}</p>
          ${dueDate ? `<p style="margin:0 0 6px;color:#6b7280;font-size:12px;text-transform:uppercase">Vencimento</p><p style="margin:0 0 14px">${esc(dueDate)}</p>` : ''}
          <p style="margin:0;color:#4b5563">Pix, boleto, NuPay, cartao de credito e cartao de debito ficam disponiveis no link.</p>
        </div>
        <p style="margin:22px 0 0">
          <a href="${esc(paymentLink)}"
             style="display:inline-block;background:#1d3a8a;color:#fff;text-decoration:none;padding:12px 18px;border-radius:6px;font-weight:bold">
            Abrir link de pagamento
          </a>
        </p>
      </div>`;

    await sendMail({
      to: email,
      subject: `Link de pagamento - ${accountName}`,
      plain,
      html,
    });

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error('[notify-payment-link] erro:', err);
    return jsonResponse({ error: String(err) }, { status: 500 });
  }
});
