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
    if (!appointmentToken) {
      return jsonResponse({ error: 'tokens invalidos' }, { status: 400 });
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // PORT-02: sem `accountToken` a chamada vem do LINK ABERTO do relatório — o gestor da casa,
    // que não tem (nem deve ter) o login do dono do contrato. Nesse modo o único portão é o
    // `report_hidden` da própria visita, conferido mais abaixo: as travas por CONTA não se
    // aplicam porque não há conta. Decisão da Ester, registrada no handoff.
    let account: { id: string; name: string; payment_link: string | null; payment_due_date: string | null } | null = null;
    let features: Record<string, boolean> = {};
    let schedulingSuspended = false;

    if (accountToken) {
      const { data: accountRow, error: accountError } = await admin
        .from('client_portal_accounts')
        .select('id, name, payment_link, payment_due_date')
        .eq('portal_token', accountToken)
        .eq('is_active', true)
        .maybeSingle();
      if (accountError) throw accountError;
      if (!accountRow) return jsonResponse({ error: 'acesso invalido' }, { status: 403 });
      account = accountRow;

      // PORT-01: inadimplência NÃO bloqueia o que já foi entregue. Antes, `scheduling_suspended`
      // impedia a assinatura da URL de todos os anexos — o cliente via o relatório na lista e
      // não conseguia abrir. Agora suspensão vale só para agendar, e esconder entrega é decisão
      // explícita por conta, resolvida em client_portal_feature_gates.
      const { data: gates, error: gatesError } = await admin.rpc('client_portal_feature_gates', {
        p_token: accountToken,
      });
      if (gatesError) throw gatesError;
      if (gates?.error) return jsonResponse({ error: 'acesso invalido' }, { status: 403 });

      features = gates?.features || {};
      schedulingSuspended = gates?.scheduling_suspended === true;
    }

    const reportsReleased = features.reports !== false;
    const photosReleased = features.photos !== false;

    const { data: requestRow, error: requestError } = await admin
      .from('appointment_requests')
      .select('id, client_id, unit_name, district, municipality, attendance_mode, appointment_type, subject, duration_minutes, consultant_names, preferred_consultant_name, meeting_url, participant_names, cancellation_reason, status, requested_date, requested_period, requested_time, requested_starts_at, requested_ends_at, report_due_at, report_due_source, report_hidden, notes, created_at, updated_at')
      .eq('public_token', appointmentToken)
      .maybeSingle();
    if (requestError) throw requestError;
    if (!requestRow?.client_id) return jsonResponse({ error: 'solicitacao nao vinculada ao cliente' }, { status: 404 });

    if (account) {
      const { data: link, error: linkError } = await admin
        .from('client_portal_account_clients')
        .select('client_id')
        .eq('account_id', account.id)
        .eq('client_id', requestRow.client_id)
        .maybeSingle();
      if (linkError) throw linkError;
      if (!link) return jsonResponse({ error: 'solicitacao fora do acesso do cliente' }, { status: 403 });
    } else if (requestRow.report_hidden) {
      // No modo link, ocultar o relatório fecha a porta inteira — não sobra nem a lista.
      return jsonResponse({ error: 'relatorio indisponivel' }, { status: 403 });
    }

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

    // Três filtros somados: tipo do compromisso, relatório oculto naquela visita e as travas
    // por conta. Relatórios e anexos andam juntos na trava `reports`; fotos têm a sua.
    const appointmentType = requestRow.appointment_type || 'inspection';
    const visibleRows = (rows || []).filter((asset) => {
      if (appointmentType !== 'inspection') return asset.kind === 'attachment' && reportsReleased;
      if (asset.kind === 'report_pdf') return reportsReleased && !requestRow.report_hidden;
      if (asset.kind === 'attachment') return reportsReleased;
      if (asset.kind === 'photo') return photosReleased;
      return true;
    });

    const assets = await Promise.all(visibleRows.map(async (asset) => {
      let signedUrl: string | undefined;
      if (asset.storage_bucket && asset.storage_path) {
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
        appointment_type: appointmentType,
        subject: requestRow.subject,
        duration_minutes: requestRow.duration_minutes,
        consultant_names: requestRow.consultant_names,
        preferred_consultant_name: requestRow.preferred_consultant_name,
        meeting_url: ['confirmed', 'in_progress', 'completed', 'report_available'].includes(requestRow.status)
          ? requestRow.meeting_url
          : null,
        participant_names: requestRow.participant_names,
        cancellation_reason: requestRow.cancellation_reason,
        status: requestRow.status,
        requested_date: requestRow.requested_date,
        requested_period: requestRow.requested_period,
        requested_time: requestRow.requested_time,
        requested_starts_at: requestRow.requested_starts_at,
        requested_ends_at: requestRow.requested_ends_at,
        report_due_at: appointmentType === 'inspection' ? requestRow.report_due_at : null,
        report_due_source: appointmentType === 'inspection' ? requestRow.report_due_source : null,
        notes: requestRow.notes,
        scheduling_suspended: schedulingSuspended,
        feature_gates: features,
        // Pelo link não há conta, então também não há cobrança: dinheiro é assunto do dono do
        // contrato, não do gestor da casa.
        payment_link: account?.payment_link || null,
        payment_due_date: account?.payment_due_date || null,
        access_mode: account ? 'account' : 'report_link',
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
