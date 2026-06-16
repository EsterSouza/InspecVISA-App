import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

function asUuid(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text) ? text : null;
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

    const payload = await req.json().catch(() => ({}));
    const accountToken = asUuid(payload.accountToken);
    const appointmentToken = asUuid(payload.appointmentToken);
    if (!accountToken || !appointmentToken) {
      return jsonResponse({ error: 'tokens invalidos' }, { status: 400 });
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: account, error: accountError } = await admin
      .from('client_portal_accounts')
      .select('id, name, scheduling_suspended, payment_link, payment_due_date')
      .eq('portal_token', accountToken)
      .eq('is_active', true)
      .maybeSingle();
    if (accountError) throw accountError;
    if (!account) return jsonResponse({ error: 'acesso invalido' }, { status: 403 });

    // Conta suspensa por pagamento: o cliente continua vendo que há relatorio/arquivos,
    // mas eles ficam bloqueados (sem URL assinada para abrir/baixar).
    const locked = account.scheduling_suspended === true;

    const { data: requestRow, error: requestError } = await admin
      .from('appointment_requests')
      .select('id, client_id, unit_name, district, municipality, attendance_mode, status, requested_date, requested_period, requested_time, requested_starts_at, requested_ends_at, report_due_at, report_due_source, report_hidden, notes, created_at, updated_at')
      .eq('public_token', appointmentToken)
      .maybeSingle();
    if (requestError) throw requestError;
    if (!requestRow?.client_id) return jsonResponse({ error: 'solicitacao nao vinculada ao cliente' }, { status: 404 });

    const { data: link, error: linkError } = await admin
      .from('client_portal_account_clients')
      .select('client_id')
      .eq('account_id', account.id)
      .eq('client_id', requestRow.client_id)
      .maybeSingle();
    if (linkError) throw linkError;
    if (!link) return jsonResponse({ error: 'solicitacao fora do acesso do cliente' }, { status: 403 });

    const { data: clientRow, error: clientError } = await admin
      .from('clients')
      .select('has_personalized_sanitary_folder, personalized_sanitary_folder_url')
      .eq('id', requestRow.client_id)
      .maybeSingle();
    if (clientError) throw clientError;

    const { data: rows, error: assetsError } = await admin
      .from('appointment_attachments')
      .select('id, tenant_id, appointment_request_id, inspection_id, kind, storage_bucket, storage_path, file_name, mime_type, caption, created_at')
      .eq('appointment_request_id', requestRow.id)
      .order('created_at', { ascending: true });
    if (assetsError) throw assetsError;

    // Relatório oculto pela equipe: não expõe os PDFs de relatório ao cliente.
    const visibleRows = requestRow.report_hidden
      ? (rows || []).filter((asset) => asset.kind !== 'report_pdf')
      : (rows || []);

    const assets = await Promise.all(visibleRows.map(async (asset) => {
      let signedUrl: string | undefined;
      // Suspenso: nao gera URL assinada (bloqueia abrir/baixar), mas mantem o item visivel.
      if (!locked && asset.storage_bucket && asset.storage_path) {
        const { data } = await admin.storage
          .from(asset.storage_bucket)
          .createSignedUrl(asset.storage_path, 60 * 60);
        signedUrl = data?.signedUrl;
      }
      return {
        ...asset,
        signed_url: signedUrl,
        storage_path: '[redacted]',
      };
    }));

    return jsonResponse({
      status: {
        id: requestRow.id,
        client_id: requestRow.client_id,
        unit_name: requestRow.unit_name,
        district: requestRow.district,
        municipality: requestRow.municipality,
        attendance_mode: requestRow.attendance_mode,
        status: requestRow.status,
        requested_date: requestRow.requested_date,
        requested_period: requestRow.requested_period,
        requested_time: requestRow.requested_time,
        requested_starts_at: requestRow.requested_starts_at,
        requested_ends_at: requestRow.requested_ends_at,
        report_due_at: requestRow.report_due_at,
        report_due_source: requestRow.report_due_source,
        notes: requestRow.notes,
        scheduling_suspended: locked,
        payment_link: account.payment_link || null,
        payment_due_date: account.payment_due_date || null,
        has_personalized_sanitary_folder: clientRow?.has_personalized_sanitary_folder || false,
        personalized_sanitary_folder_url: clientRow?.personalized_sanitary_folder_url || null,
        created_at: requestRow.created_at,
        updated_at: requestRow.updated_at,
      },
      assets,
    });
  } catch (err) {
    console.error('[client-appointment-assets] erro:', err);
    return jsonResponse({ error: String(err) }, { status: 500 });
  }
});
