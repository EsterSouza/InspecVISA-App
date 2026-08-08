// P360-012 — anexo da solicitação e aviso à equipe.
//
// A solicitação em si nasce por RPC, direto do navegador: não tem arquivo, e o token da conta
// já é a autorização. Esta função existe para as duas coisas que o Postgres não faz:
//
// 1. **gravar o byte** — é a ÚNICA porta de escrita do bucket `client-service-request-files`;
//    nenhum papel do navegador tem insert lá, e as RPCs de registro só têm grant para
//    `service_role`. Toda a autorização (token, dono da solicitação, MIME, tamanho, anexo
//    único) mora em `client_portal_attach_service_request_file`;
// 2. **avisar a equipe** que entrou demanda nova, com o mesmo cadeado de idempotência das
//    outras notificações: a linha em `client_service_request_notifications` é o cadeado.
//
// Ordem do anexo: registra (o banco gera o caminho) → sobe → se a subida falhar, limpa o
// registro. O caminho é determinístico a partir do id da solicitação, então o retry sobrescreve
// o mesmo objeto.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const BUCKET = 'client-service-request-files';
const MAX_BYTES = 10 * 1024 * 1024;

const CATEGORY_LABELS: Record<string, string> = {
  documentacao: 'Documentação',
  licenciamento: 'Licenciamento e alvará',
  notificacao_visa: 'Notificação da vigilância',
  obra_reforma: 'Obra ou reforma',
  treinamento: 'Treinamento de equipe',
  produto_equipamento: 'Produto ou equipamento',
  boas_praticas: 'Boas práticas e POPs',
  outro: 'Outro assunto',
};

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

/**
 * O tipo do arquivo sai dos bytes, não do `Content-Type` declarado nem da extensão do nome —
 * mesma regra do P360-011. Um `.pdf` que na verdade é um executável não entra no bucket.
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
    await client.send({ from: user, to: params.to, subject: params.subject, content: params.plain, html: params.html });
  } finally {
    await client.close();
  }
}

/**
 * Aviso à equipe. A linha em `client_service_request_notifications` é o cadeado: quem conseguiu
 * inserir manda o e-mail, o retry encontra conflito e não manda de novo. Chamar duas vezes
 * (com e sem anexo) não duplica o aviso.
 */
// deno-lint-ignore no-explicit-any
async function notifyTeam(admin: any, requestId: string): Promise<boolean> {
  const { data: request, error } = await admin
    .from('client_service_requests')
    .select('id, request_number, category, subject, description, client_id, account_id, attachment_name, opened_by_name, opened_by_role')
    .eq('id', requestId)
    .maybeSingle();
  if (error) throw error;
  if (!request) return false;

  const { data: inserted, error: logError } = await admin
    .from('client_service_request_notifications')
    .upsert(
      { request_id: requestId, event_type: 'created', dedupe_key: 'created' },
      { onConflict: 'request_id,event_type,dedupe_key', ignoreDuplicates: true }
    )
    .select('request_id');
  if (logError) throw logError;
  if (!(inserted || []).length) return false;

  const to = Deno.env.get('NOTIFY_TO') || Deno.env.get('SMTP_USER');
  if (!to) return false;

  const [{ data: unit }, { data: account }] = await Promise.all([
    admin.from('clients').select('name').eq('id', request.client_id).maybeSingle(),
    admin.from('client_portal_accounts').select('name').eq('id', request.account_id).maybeSingle(),
  ]);

  const category = CATEGORY_LABELS[request.category] || request.category;
  const signature = [request.opened_by_name, request.opened_by_role].filter(Boolean).join(' — ') || '-';
  const subject = `Solicitação ${request.request_number} — ${unit?.name || 'cliente'}`;
  const plain = [
    'Entrou uma solicitação nova no portal do cliente.',
    '',
    `Número: ${request.request_number}`,
    `Cliente: ${account?.name || '-'}`,
    `Unidade: ${unit?.name || '-'}`,
    `Categoria: ${category}`,
    `Assunto: ${request.subject}`,
    `Aberta por: ${signature}`,
    request.attachment_name ? `Anexo: ${request.attachment_name}` : '',
    '',
    request.description,
    '',
    'Abra Solicitações no app para assumir, priorizar ou responder.',
  ].filter(Boolean).join('\n');
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#16203C">
      <h2 style="color:#0A1638;margin:0 0 10px">Solicitação nova no portal</h2>
      <div style="border:1px solid #DDE3F0;border-radius:8px;padding:16px;background:#F4F6FA">
        <p style="margin:0 0 6px"><strong>Número:</strong> ${esc(request.request_number)}</p>
        <p style="margin:0 0 6px"><strong>Cliente:</strong> ${esc(account?.name || '-')}</p>
        <p style="margin:0 0 6px"><strong>Unidade:</strong> ${esc(unit?.name || '-')}</p>
        <p style="margin:0 0 6px"><strong>Categoria:</strong> ${esc(category)}</p>
        <p style="margin:0 0 6px"><strong>Assunto:</strong> ${esc(request.subject)}</p>
        <p style="margin:0 0 6px"><strong>Aberta por:</strong> ${esc(signature)}</p>
        ${request.attachment_name ? `<p style="margin:0"><strong>Anexo:</strong> ${esc(request.attachment_name)}</p>` : ''}
      </div>
      <p style="margin:14px 0 0;white-space:pre-wrap;color:#16203C">${esc(request.description)}</p>
      <p style="margin:18px 0 0;color:#4E5975">
        Abra <strong>Solicitações</strong> no app para assumir, priorizar ou responder.
      </p>
    </div>`;

  await sendMail({ to, subject, plain, html });
  await admin
    .from('client_service_request_notifications')
    .update({ email_sent: true })
    .eq('request_id', requestId)
    .eq('event_type', 'created')
    .eq('dedupe_key', 'created');
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

    // ─── Só avisar a equipe (JSON): solicitação aberta sem anexo ──────────────
    if (!contentType.includes('multipart/form-data')) {
      const payload = await req.json().catch(() => ({}));
      const accountToken = asUuid(payload.accountToken);
      const requestId = asUuid(payload.requestId);
      if (!accountToken || !requestId) return jsonResponse({ error: 'envio invalido' }, { status: 400 });

      // Quem dispara o aviso tem de ser dono da solicitação. Sem isto, qualquer um com a
      // chave anon poderia mandar e-mail sobre solicitação alheia.
      const { data: owner, error: ownerError } = await admin
        .from('client_service_requests')
        .select('id, account_id')
        .eq('id', requestId)
        .maybeSingle();
      if (ownerError) throw ownerError;

      const { data: account, error: accountError } = owner?.account_id
        ? await admin
          .from('client_portal_accounts')
          .select('id, portal_token, is_active')
          .eq('id', owner.account_id)
          .maybeSingle()
        : { data: null, error: null };
      if (accountError) throw accountError;

      if (!owner || !account?.is_active || account.portal_token !== accountToken) {
        return jsonResponse({ error: 'acesso invalido' }, { status: 403 });
      }

      let teamNotified = false;
      let notifyError: string | undefined;
      try {
        teamNotified = await notifyTeam(admin, requestId);
      } catch (err) {
        // A solicitação já está registrada: falhar o aviso não pode fazer o cliente reenviar.
        notifyError = String(err);
        console.error('[client-service-request] aviso a equipe falhou:', err);
      }
      return jsonResponse({ ok: true, teamNotified, notifyError });
    }

    // ─── Anexar (multipart) ───────────────────────────────────────────────────
    const form = await req.formData();
    const accountToken = asUuid(form.get('accountToken'));
    const requestId = asUuid(form.get('requestId'));
    const file = form.get('file');

    if (!accountToken || !requestId) {
      return jsonResponse({ error: 'envio invalido' }, { status: 400 });
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

    const { data: registered, error: registerError } = await admin.rpc(
      'client_portal_attach_service_request_file',
      {
        p_token: accountToken,
        p_request_id: requestId,
        p_file_name: file.name,
        p_mime_type: mimeType,
        p_file_size: buffer.byteLength,
      }
    );
    if (registerError) throw registerError;
    if (registered?.error) return jsonResponse({ error: registered.error }, { status: 403 });

    const { error: uploadError } = await admin.storage
      .from(registered.storage_bucket || BUCKET)
      .upload(registered.storage_path, buffer, { contentType: mimeType, upsert: true });

    if (uploadError) {
      // Sem arquivo, o registro do anexo é mentira na tela do cliente: some com ele. A
      // solicitação em si continua de pé — o pedido dele vale mesmo sem o arquivo.
      await admin.rpc('client_portal_discard_service_request_file', {
        p_token: accountToken,
        p_request_id: requestId,
      });
      console.error('[client-service-request] falha ao gravar o objeto:', uploadError);
      return jsonResponse({ error: 'nao foi possivel guardar o arquivo agora' }, { status: 502 });
    }

    let teamNotified = false;
    let notifyError: string | undefined;
    try {
      teamNotified = await notifyTeam(admin, requestId);
    } catch (err) {
      notifyError = String(err);
      console.error('[client-service-request] aviso a equipe falhou:', err);
    }

    return jsonResponse({
      ok: true,
      file_name: registered.file_name,
      teamNotified,
      notifyError,
    });
  } catch (err) {
    console.error('[client-service-request] erro:', err);
    return jsonResponse({ error: String(err) }, { status: 500 });
  }
});
