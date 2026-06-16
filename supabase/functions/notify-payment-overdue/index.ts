import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

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
    await client.send({
      from: user,
      to: params.to,
      subject: params.subject,
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
    const accountName = String(payload.accountName ?? 'Cliente').trim();
    const dueDate = formatDateBR(payload.dueDate ? String(payload.dueDate) : null);
    const paymentLink = String(payload.paymentLink ?? '').trim();

    if (!email) {
      return jsonResponse({ error: 'email obrigatorio' }, { status: 400 });
    }

    const dueLine = dueDate ? `Vencimento original: ${dueDate}` : '';
    const plain = [
      'Aviso de pagamento em atraso',
      '',
      `Prezado(a) ${accountName},`,
      '',
      'Identificamos que o pagamento referente aos nossos serviços encontra-se em atraso.',
      dueLine,
      '',
      'Solicitamos a regularização o quanto antes. Conforme estabelecido em contrato, o atraso',
      'implica a incidência de multa e juros proporcionais ao tempo de inadimplência.',
      '',
      paymentLink ? `Para regularizar, acesse: ${paymentLink}` : '',
      '',
      'Caso o pagamento já tenha sido efetuado, por favor desconsidere este aviso.',
      '',
      'Atenciosamente,',
      'Equipe InspecVISA / TreinaVISA',
    ].filter(Boolean).join('\n');

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1f2937">
        <h2 style="color:#101D45;margin:0 0 10px">Aviso de pagamento em atraso</h2>
        <p style="color:#4b5563;margin:0 0 16px">Prezado(a) <strong>${esc(accountName)}</strong>,</p>
        <p style="color:#4b5563;margin:0 0 16px">
          Identificamos que o pagamento referente aos nossos serviços encontra-se em atraso.
          Solicitamos a sua regularização o quanto antes.
        </p>
        <div style="border:1px solid #fde68a;border-radius:8px;padding:16px;background:#fffbeb;margin:0 0 18px">
          ${dueDate ? `<p style="margin:0 0 6px;color:#92400e;font-size:12px;text-transform:uppercase">Vencimento original</p><p style="margin:0 0 12px;font-weight:bold;color:#92400e">${esc(dueDate)}</p>` : ''}
          <p style="margin:0;color:#92400e">
            Conforme estabelecido em contrato, o atraso implica a incidência de <strong>multa e juros</strong>
            proporcionais ao tempo de inadimplência.
          </p>
        </div>
        ${paymentLink ? `
        <p style="margin:0 0 18px">
          <a href="${esc(paymentLink)}"
             style="display:inline-block;background:#1d3a8a;color:#fff;text-decoration:none;padding:12px 18px;border-radius:6px;font-weight:bold">
            Regularizar pagamento
          </a>
        </p>` : ''}
        <p style="color:#9ca3af;font-size:12px;margin:0">
          Caso o pagamento já tenha sido efetuado, por favor desconsidere este aviso.
        </p>
      </div>`;

    await sendMail({
      to: email,
      subject: `Pagamento em atraso - regularização necessária (${accountName})`,
      plain,
      html,
    });

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error('[notify-payment-overdue] erro:', err);
    return jsonResponse({ error: String(err) }, { status: 500 });
  }
});
