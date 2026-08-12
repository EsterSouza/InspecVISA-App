// P360-011 — envio e leitura da evidência de correção pelo cliente.
//
// Esta função é a ÚNICA porta de escrita do bucket `client-action-evidence`: nenhum papel do
// navegador tem privilégio de insert lá, e as RPCs de registro só têm grant para `service_role`.
// Toda a autorização (token da conta, trava do plano de ação, vínculo do item com a unidade,
// MIME, tamanho, teto por pendência) mora no Postgres, em `client_portal_submit_evidence`.
// Aqui ficam só as três coisas que o banco não faz: conferir o byte, gravar o objeto e avisar
// a equipe.
//
// Ordem: registra (o banco gera o caminho) → sobe → se a subida falhar, descarta o registro.
// O caminho é determinístico a partir da `uploadKey`, então o retry sobrescreve o mesmo objeto
// e reencontra a mesma linha.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';
import { safeMailSubject } from '../_shared/mailSubject.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const BUCKET = 'client-action-evidence';
const MAX_BYTES = 10 * 1024 * 1024;
// A URL do cliente é curta de propósito: ele acabou de mandar o arquivo e só quer conferir.
// Renovar é reabrir a lista, que assina de novo.
const CLIENT_SIGNED_URL_SECONDS = 600;

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

function asUuid(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text) ? text : null;
}

function esc(value: unknown): string {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * O tipo do arquivo sai dos bytes, não do `Content-Type` que o navegador declarou nem da
 * extensão do nome. Um `.pdf` que na verdade é um executável não entra no bucket, e o
 * `contentType` gravado no Storage passa a ser o real — é ele que a URL assinada devolve
 * depois para o navegador da consultora.
 */
function sniffMimeType(bytes: Uint8Array): string | null {
  const startsWith = (...sig: number[]) => sig.every((byte, i) => bytes[i] === byte);

  if (startsWith(0x25, 0x50, 0x44, 0x46)) return 'application/pdf'; // %PDF
  if (startsWith(0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
  if (
    startsWith(0x52, 0x49, 0x46, 0x46) && // RIFF
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50 // WEBP
  ) {
    return 'image/webp';
  }
  return null;
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

// deno-lint-ignore no-explicit-any
async function notifyTeam(admin: any, evidenceId: string, info: {
  accountName: string;
  unitName: string;
  itemTitle: string;
  fileName: string;
  byName: string;
  byRole: string;
}) {
  // A linha é o cadeado: quem conseguiu inserir manda o e-mail. Retry cai no conflito.
  const { data: inserted, error } = await admin
    .from('client_action_evidence_notifications')
    .upsert(
      { evidence_id: evidenceId, event_type: 'submitted', dedupe_key: 'submitted' },
      { onConflict: 'evidence_id,event_type,dedupe_key', ignoreDuplicates: true }
    )
    .select('evidence_id');
  if (error) throw error;
  if (!(inserted || []).length) return false;

  const to = Deno.env.get('NOTIFY_TO') || Deno.env.get('SMTP_USER');
  if (!to) return false;

  const subject = `Evidencia enviada — ${info.unitName}`;
  const plain = [
    'O cliente enviou uma evidencia de correcao.',
    '',
    `Enviado por: ${info.byName} — ${info.byRole}`,
    `Cliente: ${info.accountName}`,
    `Unidade: ${info.unitName}`,
    `Pendencia: ${info.itemTitle}`,
    `Arquivo: ${info.fileName}`,
    '',
    'Abra Agendamentos > plano de acao no portal para revisar e aprovar ou devolver.',
  ].join('\n');
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#16203C">
      <h2 style="color:#0A1638;margin:0 0 10px">Evidencia enviada pelo cliente</h2>
      <div style="border:1px solid #DDE3F0;border-radius:8px;padding:16px;background:#F4F6FA">
        <p style="margin:0 0 6px"><strong>Enviado por:</strong> ${esc(info.byName)} &mdash; ${esc(info.byRole)}</p>
        <p style="margin:0 0 6px"><strong>Cliente:</strong> ${esc(info.accountName)}</p>
        <p style="margin:0 0 6px"><strong>Unidade:</strong> ${esc(info.unitName)}</p>
        <p style="margin:0 0 6px"><strong>Pendencia:</strong> ${esc(info.itemTitle)}</p>
        <p style="margin:0"><strong>Arquivo:</strong> ${esc(info.fileName)}</p>
      </div>
      <p style="margin:18px 0 0;color:#4E5975">
        Abra <strong>Agendamentos &rsaquo; plano de acao</strong> para revisar: aprovar ou devolver com orientacao.
      </p>
    </div>`;

  await sendMail({ to, subject, plain, html });
  await admin
    .from('client_action_evidence_notifications')
    .update({ email_sent: true })
    .eq('evidence_id', evidenceId)
    .eq('event_type', 'submitted')
    .eq('dedupe_key', 'submitted');
  return true;
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) {
      return jsonResponse({ error: 'Supabase service role nao configurado' }, { status: 500 });
    }
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const contentType = req.headers.get('content-type') || '';

    // ─── Listar (JSON) ───────────────────────────────────────────────────────
    //
    // Dois caminhos, duas RPCs: `accountToken` é o login do portal; `visitToken` é o link
    // aberto do relatório (PORT-02). A escolha é feita aqui, mas a regra de quem pode ver o
    // quê continua inteira no Postgres, uma por caminho.
    if (!contentType.includes('multipart/form-data')) {
      const payload = await req.json().catch(() => ({}));
      const accountToken = asUuid(payload.accountToken);
      const visitToken = asUuid(payload.visitToken);
      if (!accountToken && !visitToken) return jsonResponse({ error: 'token invalido' }, { status: 400 });

      const { data, error } = accountToken
        ? await admin.rpc('client_portal_list_evidence', {
          p_token: accountToken,
          p_action_item_id: asUuid(payload.actionItemId),
        })
        : await admin.rpc('public_report_list_evidence', {
          p_visit_token: visitToken,
          p_action_item_id: asUuid(payload.actionItemId),
        });
      if (error) throw error;
      if (data?.error) return jsonResponse({ error: data.error }, { status: 403 });

      const evidence = await Promise.all((data?.evidence || []).map(async (row: Record<string, unknown>) => {
        const { data: signed } = await admin.storage
          .from(String(row.storage_bucket || BUCKET))
          .createSignedUrl(String(row.storage_path), CLIENT_SIGNED_URL_SECONDS);
        const { storage_bucket: _b, storage_path: _p, ...safe } = row;
        return { ...safe, signed_url: signed?.signedUrl, signed_url_expires_in: CLIENT_SIGNED_URL_SECONDS };
      }));

      return jsonResponse({ evidence });
    }

    // ─── Enviar (multipart) ──────────────────────────────────────────────────
    const form = await req.formData();
    const accountToken = asUuid(form.get('accountToken'));
    const visitToken = asUuid(form.get('visitToken'));
    const actionItemId = asUuid(form.get('actionItemId'));
    const uploadKey = asUuid(form.get('uploadKey'));
    const note = String(form.get('note') ?? '').trim().slice(0, 1000);
    // PORT-02: sem login, é a assinatura que diz quem alegou o quê. Obrigatória nos dois
    // caminhos — a conta do portal é da empresa, não da pessoa.
    const byName = String(form.get('byName') ?? '').trim().slice(0, 120);
    const byRole = String(form.get('byRole') ?? '').trim().slice(0, 120);
    const file = form.get('file');

    if ((!accountToken && !visitToken) || !actionItemId || !uploadKey) {
      return jsonResponse({ error: 'envio invalido' }, { status: 400 });
    }
    if (!byName || !byRole) {
      return jsonResponse({ error: 'informe seu nome e sua funcao' }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return jsonResponse({ error: 'arquivo ausente' }, { status: 400 });
    }
    if (file.size <= 0) {
      return jsonResponse({ error: 'arquivo vazio' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return jsonResponse({ error: 'arquivo acima do limite de 10 MB' }, { status: 400 });
    }

    const buffer = new Uint8Array(await file.arrayBuffer());
    const mimeType = sniffMimeType(buffer);
    if (!mimeType) {
      return jsonResponse(
        { error: 'tipo de arquivo nao aceito — envie PDF, JPG, PNG ou WEBP' },
        { status: 400 }
      );
    }

    const { data: registered, error: registerError } = accountToken
      ? await admin.rpc('client_portal_submit_evidence', {
        p_token: accountToken,
        p_action_item_id: actionItemId,
        p_upload_key: uploadKey,
        p_file_name: file.name,
        p_mime_type: mimeType,
        p_file_size: buffer.byteLength,
        p_by_name: byName,
        p_by_role: byRole,
        p_note: note || null,
        p_user_agent: req.headers.get('user-agent'),
      })
      : await admin.rpc('public_report_submit_evidence', {
        p_visit_token: visitToken,
        p_action_item_id: actionItemId,
        p_upload_key: uploadKey,
        p_file_name: file.name,
        p_mime_type: mimeType,
        p_file_size: buffer.byteLength,
        p_by_name: byName,
        p_by_role: byRole,
        p_note: note || null,
        p_user_agent: req.headers.get('user-agent'),
      });
    if (registerError) throw registerError;
    if (registered?.error) return jsonResponse({ error: registered.error }, { status: 403 });

    const { error: uploadError } = await admin.storage
      .from(registered.storage_bucket || BUCKET)
      .upload(registered.storage_path, buffer, { contentType: mimeType, upsert: true });

    if (uploadError) {
      // Sem arquivo, o registro é ruído: some com ele para o cliente poder tentar de novo.
      if (!registered.duplicate) {
        if (accountToken) {
          await admin.rpc('client_portal_discard_evidence', {
            p_token: accountToken,
            p_evidence_id: registered.evidence_id,
          });
        } else {
          await admin.rpc('public_report_discard_evidence', {
            p_visit_token: visitToken,
            p_evidence_id: registered.evidence_id,
          });
        }
      }
      console.error('[client-action-evidence] falha ao gravar o objeto:', uploadError);
      return jsonResponse({ error: 'nao foi possivel guardar o arquivo agora' }, { status: 502 });
    }

    let teamNotified = false;
    let notifyError: string | undefined;
    try {
      teamNotified = await notifyTeam(admin, registered.evidence_id, {
        // Pelo link não há conta; quem responde pelo envio é a assinatura, e é ela que a
        // equipe precisa ler no aviso.
        accountName: registered.account_name || `${byName} (${byRole})`,
        unitName: registered.unit_name || '-',
        itemTitle: registered.item_title || '-',
        fileName: registered.file_name || 'arquivo',
        byName,
        byRole,
      });
    } catch (err) {
      // O arquivo já está guardado: falhar o aviso não pode fazer o cliente reenviar.
      notifyError = String(err);
      console.error('[client-action-evidence] aviso a equipe falhou:', err);
    }

    return jsonResponse({
      ok: true,
      evidence_id: registered.evidence_id,
      status: registered.status,
      duplicate: !!registered.duplicate,
      teamNotified,
      notifyError,
    });
  } catch (err) {
    console.error('[client-action-evidence] erro:', err);
    return jsonResponse({ error: String(err) }, { status: 500 });
  }
});
