import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

function esc(value: unknown): string {
  return String(value ?? '-')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function text(value: unknown): string {
  return String(value ?? '-');
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
    const expected = Deno.env.get('NOTIFY_SECRET');
    if (!expected) {
      return new Response(JSON.stringify({ error: 'NOTIFY_SECRET nao configurado' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (req.headers.get('x-notify-secret') !== expected) {
      return new Response('unauthorized', { status: 401 });
    }

    const payload = await req.json().catch(() => ({}));
    const rec = payload.record ?? payload ?? {};
    const to = Deno.env.get('NOTIFY_TO') || Deno.env.get('SMTP_USER');
    if (!to) {
      throw new Error('NOTIFY_TO nao configurado');
    }

    const unit = text(rec.unit_name);
    const date = text(rec.requested_date);
    const time = text(rec.requested_time);
    const district = text(rec.district);
    const municipality = text(rec.municipality);
    const mode = text(rec.attendance_mode);
    const phone = text(rec.phone);
    const email = text(rec.email);
    const notes = text(rec.notes);

    const plain = [
      'Nova solicitacao de inspecao',
      '',
      `Unidade: ${unit}`,
      `Data / horario: ${date} ${time}`,
      `Atendimento: ${mode} - ${district}${municipality !== '-' ? `, ${municipality}` : ''}`,
      `WhatsApp: ${phone}`,
      `E-mail: ${email}`,
      `Observacoes: ${notes}`,
      '',
      'Painel: https://inspecvisa.consultorasanitaria.com.br/login',
    ].join('\n');

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1f2937">
        <h2 style="color:#101D45;margin:0 0 12px">Nova solicitacao de inspecao</h2>
        <p style="color:#4b5563;margin:0 0 18px">Recebida pelo portal publico de agendamento.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:7px 0;color:#6b7280">Unidade</td><td style="padding:7px 0;font-weight:bold">${esc(unit)}</td></tr>
          <tr><td style="padding:7px 0;color:#6b7280">Data / horario</td><td style="padding:7px 0">${esc(date)} ${esc(time)}</td></tr>
          <tr><td style="padding:7px 0;color:#6b7280">Atendimento</td><td style="padding:7px 0">${esc(mode)} - ${esc(district)}${municipality !== '-' ? ', ' + esc(municipality) : ''}</td></tr>
          <tr><td style="padding:7px 0;color:#6b7280">WhatsApp</td><td style="padding:7px 0">${esc(phone)}</td></tr>
          <tr><td style="padding:7px 0;color:#6b7280">E-mail</td><td style="padding:7px 0">${esc(email)}</td></tr>
          <tr><td style="padding:7px 0;color:#6b7280;vertical-align:top">Observacoes</td><td style="padding:7px 0">${esc(notes)}</td></tr>
        </table>
        <p style="margin:22px 0 0">
          <a href="https://inspecvisa.consultorasanitaria.com.br/login"
             style="display:inline-block;background:#1d3a8a;color:#fff;text-decoration:none;padding:11px 18px;border-radius:6px;font-weight:bold">
            Abrir o painel
          </a>
        </p>
      </div>`;

    await sendMail({
      to,
      subject: `Nova solicitacao de inspecao - ${unit}`,
      plain,
      html,
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[notify-new-appointment] erro:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
