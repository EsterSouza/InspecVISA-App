// Edge Function: notify-new-appointment
// Dispara um e-mail para a equipe sempre que uma nova solicitacao publica
// de agendamento e criada. Acionada por trigger do banco (pg_net) com um
// cabecalho compartilhado x-notify-secret (autenticacao propria → verify_jwt off).
//
// Segredos necessarios (Supabase → Edge Functions → Secrets):
//   SMTP_HOST   (ex.: smtp.hostinger.com)
//   SMTP_PORT   (ex.: 465)
//   SMTP_USER   (ex.: contato@consultorasanitaria.com.br)
//   SMTP_PASS   (senha do e-mail — sensivel)
//   NOTIFY_TO   (destino do aviso; default = SMTP_USER)
//   NOTIFY_SECRET (mesmo valor usado no trigger do banco)

import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

function esc(value: unknown): string {
  return String(value ?? '—')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

Deno.serve(async (req) => {
  try {
    const expected = Deno.env.get('NOTIFY_SECRET');
    if (expected && req.headers.get('x-notify-secret') !== expected) {
      return new Response('unauthorized', { status: 401 });
    }

    const payload = await req.json().catch(() => ({}));
    const rec = payload.record ?? payload ?? {};

    const user = Deno.env.get('SMTP_USER');
    const pass = Deno.env.get('SMTP_PASS');
    if (!user || !pass) {
      return new Response(JSON.stringify({ error: 'SMTP nao configurado' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const to = Deno.env.get('NOTIFY_TO') || user;
    const unit = esc(rec.unit_name);
    const date = esc(rec.requested_date);
    const time = esc(rec.requested_time);
    const district = esc(rec.district);
    const municipality = esc(rec.municipality);
    const mode = esc(rec.attendance_mode);
    const phone = esc(rec.phone);
    const email = esc(rec.email);
    const notes = esc(rec.notes);

    const client = new SMTPClient({
      connection: {
        hostname: Deno.env.get('SMTP_HOST') || 'smtp.hostinger.com',
        port: Number(Deno.env.get('SMTP_PORT') || '465'),
        tls: true,
        auth: { username: user, password: pass },
      },
    });

    await client.send({
      from: user,
      to,
      subject: `Nova solicitação de inspeção — ${unit}`,
      content: 'text/html',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto">
          <h2 style="color:#101D45;margin:0 0 12px">Nova solicitação de inspeção</h2>
          <p style="color:#555;margin:0 0 16px">Recebida pelo portal público de agendamento.</p>
          <table style="width:100%;border-collapse:collapse;font-size:14px;color:#222">
            <tr><td style="padding:6px 0;color:#888">Unidade</td><td style="padding:6px 0;font-weight:bold">${unit}</td></tr>
            <tr><td style="padding:6px 0;color:#888">Data / horário</td><td style="padding:6px 0">${date} ${time}</td></tr>
            <tr><td style="padding:6px 0;color:#888">Atendimento</td><td style="padding:6px 0">${mode} — ${district}${municipality !== '—' ? ', ' + municipality : ''}</td></tr>
            <tr><td style="padding:6px 0;color:#888">WhatsApp</td><td style="padding:6px 0">${phone}</td></tr>
            <tr><td style="padding:6px 0;color:#888">E-mail</td><td style="padding:6px 0">${email}</td></tr>
            <tr><td style="padding:6px 0;color:#888;vertical-align:top">Observações</td><td style="padding:6px 0">${notes}</td></tr>
          </table>
          <p style="margin:20px 0 0">
            <a href="https://inspecvisa.consultorasanitaria.com.br/login"
               style="display:inline-block;background:#1d3a8a;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:bold">
              Abrir o painel
            </a>
          </p>
        </div>`,
    });
    await client.close();

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
